#!/usr/bin/env node
/**
 * Verify embeddings quality and correctness
 * Tests similarity search with known cards
 *
 * Usage:
 *   npx tsx scripts/verify-embeddings.ts [embeddings.bin]
 *   npx tsx scripts/verify-embeddings.ts --test-image <image-path>
 */
import { pipeline } from '@huggingface/transformers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { cardIdToFilename } from '../src/utils/cardIdUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const MODEL_ID = 'Xenova/mobileclip_s2';
const DEFAULT_EMBEDDINGS_FILE = path.join(PROJECT_ROOT, 'public', 'embeddings.bin');
const CARD_IMAGES_DIR = path.join(PROJECT_ROOT, 'card-images');
const EMBEDDING_DIM = 512;

interface EmbeddingsData {
  cardIds: string[];
  embeddings: Float32Array[];
  dimension: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null;

async function loadModel(): Promise<any> {
  if (model) return model;
  console.log(`Loading model: ${MODEL_ID}...`);
  model = await pipeline('image-feature-extraction', MODEL_ID);
  console.log('Model loaded successfully\n');
  return model;
}

/**
 * Read binary embeddings file
 */
function loadBinaryEmbeddings(inputPath: string): EmbeddingsData {
  const buffer = fs.readFileSync(inputPath);
  let offset = 0;

  // Read header
  const numCards = buffer.readUInt32LE(offset); offset += 4;
  const dim = buffer.readUInt32LE(offset); offset += 4;

  const cardIds: string[] = [];
  const embeddings: Float32Array[] = [];

  // Read each card
  for (let i = 0; i < numCards; i++) {
    const cardIdLen = buffer.readUInt8(offset); offset += 1;
    const cardId = buffer.toString('utf-8', offset, offset + cardIdLen); offset += cardIdLen;

    const embedding = new Float32Array(dim);
    for (let j = 0; j < dim; j++) {
      embedding[j] = buffer.readFloatLE(offset); offset += 4;
    }

    cardIds.push(cardId);
    embeddings.push(embedding);
  }

  return { cardIds, embeddings, dimension: dim };
}

/**
 * Compute cosine similarity between two embeddings
 */
function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find top-K similar cards to a query embedding
 */
function findSimilar(
  queryEmbedding: Float32Array | number[],
  data: EmbeddingsData,
  topK: number = 5
): { cardId: string; score: number }[] {
  const scores: { cardId: string; score: number }[] = [];

  for (let i = 0; i < data.cardIds.length; i++) {
    const score = cosineSimilarity(queryEmbedding, data.embeddings[i]);
    scores.push({ cardId: data.cardIds[i], score });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Get embedding for an image
 */
async function getImageEmbedding(imagePath: string): Promise<Float32Array> {
  const m = await loadModel();
  const output = await m(imagePath, { pooling: 'mean', normalize: true });
  return new Float32Array(output.data);
}

/**
 * Find image path for a card ID
 */
function findCardImage(cardId: string): string | null {
  const filename = cardIdToFilename(cardId);
  const extensions = ['.webp', '.png', '.jpg', '.jpeg'];

  for (const ext of extensions) {
    const imagePath = path.join(CARD_IMAGES_DIR, filename + ext);
    if (fs.existsSync(imagePath)) {
      return imagePath;
    }
  }
  return null;
}

/**
 * Verify basic file integrity
 */
function verifyFileIntegrity(data: EmbeddingsData): void {
  console.log('=== File Integrity Check ===');
  console.log(`Total cards: ${data.cardIds.length}`);
  console.log(`Embedding dimension: ${data.dimension}`);

  // Check for expected dimension
  if (data.dimension !== EMBEDDING_DIM) {
    console.error(`WARNING: Expected dimension ${EMBEDDING_DIM}, got ${data.dimension}`);
  } else {
    console.log(`Dimension check: PASS`);
  }

  // Check for unique card IDs
  const uniqueIds = new Set(data.cardIds);
  if (uniqueIds.size !== data.cardIds.length) {
    console.error(`WARNING: Found ${data.cardIds.length - uniqueIds.size} duplicate card IDs`);
  } else {
    console.log(`Uniqueness check: PASS`);
  }

  // Check embedding norms (should be ~1.0 for normalized embeddings)
  let minNorm = Infinity;
  let maxNorm = -Infinity;
  for (const emb of data.embeddings) {
    let norm = 0;
    for (let i = 0; i < emb.length; i++) {
      norm += emb[i] * emb[i];
    }
    norm = Math.sqrt(norm);
    minNorm = Math.min(minNorm, norm);
    maxNorm = Math.max(maxNorm, norm);
  }
  console.log(`Embedding norm range: ${minNorm.toFixed(4)} - ${maxNorm.toFixed(4)}`);

  if (minNorm > 0.99 && maxNorm < 1.01) {
    console.log(`Normalization check: PASS`);
  } else {
    console.log(`Normalization check: WARNING (expected ~1.0)`);
  }

  // Estimate file size
  const estimatedSize = 8 + data.cardIds.reduce((acc, id) => acc + 1 + id.length + EMBEDDING_DIM * 4, 0);
  console.log(`Estimated file size: ${(estimatedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
}

/**
 * Test self-similarity (same card should match itself perfectly)
 */
async function testSelfSimilarity(data: EmbeddingsData): Promise<void> {
  console.log('=== Self-Similarity Test ===');
  console.log('Testing that cards match themselves with score ~1.0...\n');

  // Sample a few cards
  const sampleSize = Math.min(5, data.cardIds.length);
  const indices = [];
  for (let i = 0; i < sampleSize; i++) {
    indices.push(Math.floor(Math.random() * data.cardIds.length));
  }

  for (const idx of indices) {
    const cardId = data.cardIds[idx];
    const embedding = data.embeddings[idx];
    const imagePath = findCardImage(cardId);

    if (!imagePath) {
      console.log(`  ${cardId}: Image not found, skipping`);
      continue;
    }

    // Get fresh embedding
    const freshEmbedding = await getImageEmbedding(imagePath);
    const selfScore = cosineSimilarity(embedding, freshEmbedding);

    const status = selfScore > 0.99 ? 'PASS' : selfScore > 0.95 ? 'WARN' : 'FAIL';
    console.log(`  ${cardId}: self-similarity = ${selfScore.toFixed(4)} [${status}]`);
  }
  console.log('');
}

/**
 * Test similarity search with a specific image
 */
async function testWithImage(imagePath: string, data: EmbeddingsData): Promise<void> {
  console.log(`=== Similarity Search Test ===`);
  console.log(`Query image: ${imagePath}\n`);

  if (!fs.existsSync(imagePath)) {
    console.error(`Image not found: ${imagePath}`);
    return;
  }

  const queryEmbedding = await getImageEmbedding(imagePath);
  const results = findSimilar(queryEmbedding, data, 10);

  console.log('Top 10 matches:');
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.cardId} (score: ${r.score.toFixed(4)})`);
  });
  console.log('');
}

/**
 * Test distribution of similarity scores
 */
function testScoreDistribution(data: EmbeddingsData): void {
  console.log('=== Score Distribution Test ===');
  console.log('Computing similarity statistics between random card pairs...\n');

  const numSamples = 1000;
  const scores: number[] = [];

  for (let i = 0; i < numSamples; i++) {
    const idx1 = Math.floor(Math.random() * data.cardIds.length);
    let idx2 = Math.floor(Math.random() * data.cardIds.length);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * data.cardIds.length);
    }

    const score = cosineSimilarity(data.embeddings[idx1], data.embeddings[idx2]);
    scores.push(score);
  }

  scores.sort((a, b) => a - b);

  const min = scores[0];
  const max = scores[scores.length - 1];
  const median = scores[Math.floor(scores.length / 2)];
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const p10 = scores[Math.floor(scores.length * 0.1)];
  const p90 = scores[Math.floor(scores.length * 0.9)];

  console.log(`  Min:    ${min.toFixed(4)}`);
  console.log(`  P10:    ${p10.toFixed(4)}`);
  console.log(`  Median: ${median.toFixed(4)}`);
  console.log(`  Mean:   ${mean.toFixed(4)}`);
  console.log(`  P90:    ${p90.toFixed(4)}`);
  console.log(`  Max:    ${max.toFixed(4)}`);
  console.log('');

  // Check for reasonable distribution
  if (mean > 0.2 && mean < 0.8 && (max - min) > 0.3) {
    console.log('Distribution looks reasonable: PASS');
  } else {
    console.log('Distribution might be unusual: CHECK');
  }
  console.log('');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments
  let embeddingsPath = DEFAULT_EMBEDDINGS_FILE;
  let testImagePath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--test-image' && args[i + 1]) {
      testImagePath = args[++i];
    } else if (!args[i].startsWith('--')) {
      embeddingsPath = args[i];
    }
  }

  console.log('=== Embeddings Verification Tool ===\n');

  // Check file exists
  if (!fs.existsSync(embeddingsPath)) {
    console.error(`Embeddings file not found: ${embeddingsPath}`);
    console.log('Run build-embeddings.ts first to generate the file.');
    process.exit(1);
  }

  // Load embeddings
  console.log(`Loading embeddings from: ${embeddingsPath}\n`);
  const data = loadBinaryEmbeddings(embeddingsPath);

  // Run verification tests
  verifyFileIntegrity(data);
  testScoreDistribution(data);

  // Test with specific image if provided
  if (testImagePath) {
    await testWithImage(testImagePath, data);
  }

  // Run self-similarity test
  await testSelfSimilarity(data);

  console.log('=== Verification Complete ===');
}

main().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});
