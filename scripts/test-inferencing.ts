#!/usr/bin/env tsx
/**
 * Test the exact inferencing pipeline used by the app
 *
 * Usage:
 *   tsx scripts/test-inferencing.ts <image-path> [--top N]
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { MODEL_CONFIG, MODEL_ID } from '../src/config/model-config.js';
import { loadModel, getImageEmbedding } from './lib/model.js';
import { findSimilar } from '../src/services/scanner/similarity.js';
import type { EmbeddingIndex } from '../src/services/scanner/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEmbeddings(filePath: string): EmbeddingIndex {
  const buffer = fs.readFileSync(filePath);
  let offset = 0;

  const cardCount = buffer.readUInt32LE(offset);
  offset += 4;
  const embeddingDim = buffer.readUInt32LE(offset);
  offset += 4;

  const cardIds: string[] = [];
  const embeddings = new Float32Array(cardCount * embeddingDim);

  for (let i = 0; i < cardCount; i++) {
    const cardIdLength = buffer.readUInt8(offset);
    offset += 1;
    const cardId = buffer.toString('utf-8', offset, offset + cardIdLength);
    cardIds.push(cardId);
    offset += cardIdLength;

    for (let j = 0; j < embeddingDim; j++) {
      embeddings[i * embeddingDim + j] = buffer.readFloatLE(offset);
      offset += 4;
    }
  }

  return { cardIds, embeddings };
}

function formatScore(score: number): string {
  return `${(score * 100).toFixed(2)}%`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let imagePath: string | undefined;
  let topK = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--top' && args[i + 1]) {
      topK = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: tsx scripts/test-inferencing.ts <image-path> [--top N]

Options:
  --top N     Number of results (default: 5)
  --help      Show this help
`);
      process.exit(0);
    } else if (!args[i].startsWith('-')) {
      imagePath = args[i];
    }
  }

  if (!imagePath) {
    console.error('Error: Please provide an image path');
    process.exit(1);
  }

  if (!path.isAbsolute(imagePath)) {
    imagePath = path.resolve(process.cwd(), imagePath);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`Error: Image not found: ${imagePath}`);
    process.exit(1);
  }

  const embeddingsFile = path.resolve(__dirname, '..', MODEL_CONFIG.output.embeddingsFile);

  console.log('=== Test Inferencing Pipeline ===\n');
  console.log(`Image: ${imagePath}`);
  console.log(`Model: ${MODEL_ID}`);

  // Load model
  const startLoad = Date.now();
  await loadModel();
  console.log(`  Model loaded in ${Date.now() - startLoad}ms\n`);

  // Generate embedding
  console.log('Generating embedding...');
  const startEmbed = Date.now();
  const embedding = await getImageEmbedding(imagePath);
  console.log(`  Done in ${Date.now() - startEmbed}ms\n`);

  // Load embeddings database
  console.log('Loading embeddings database...');
  const startLoadEmb = Date.now();
  const index = loadEmbeddings(embeddingsFile);
  console.log(`  Loaded ${index.cardIds.length} cards in ${Date.now() - startLoadEmb}ms\n`);

  // Find similar
  console.log(`Finding top ${topK} similar cards...`);
  const startSearch = Date.now();
  const results = findSimilar(embedding, index, topK);
  console.log(`  Done in ${Date.now() - startSearch}ms\n`);

  // Display results
  console.log('=== Results ===\n');
  console.log('Rank  Score     Card ID');
  console.log('----  --------  -------');

  results.forEach((result, i) => {
    const rank = String(i + 1).padStart(2, ' ');
    const score = formatScore(result.score).padStart(8, ' ');
    console.log(`${rank}.   ${score}  ${result.cardId}`);
  });

  console.log();
  const topScore = results[0]?.score ?? 0;
  if (topScore > 0.95) {
    console.log(`✓ High confidence match (${formatScore(topScore)})`);
  } else if (topScore > 0.85) {
    console.log(`~ Moderate confidence match (${formatScore(topScore)})`);
  } else {
    console.log(`? Low confidence (${formatScore(topScore)})`);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
