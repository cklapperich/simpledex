#!/usr/bin/env tsx
/**
 * Build embeddings database from local card images using transformers.js
 * TypeScript alternative to build-embeddings.py - useful for testing pipeline compatibility
 *
 * Usage:
 *   npm run embeddings:build:ts
 *   npm run embeddings:build:ts -- --batch-size 8
 *   npm run embeddings:search -- <image-path>
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from '@huggingface/transformers';
import { MODEL_CONFIG, MODEL_ID, DTYPE, INFERENCE_OPTIONS, EMBEDDING_DIM } from '../src/config/model-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CARD_IMAGES_DIR = path.join(PROJECT_ROOT, 'card-images');
const OUTPUT_FILE = path.join(PROJECT_ROOT, MODEL_CONFIG.output.embeddingsFile);
const CHECKPOINT_FILE = path.join(PROJECT_ROOT, 'embeddings-checkpoint.json');

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// Filesystem character mapping (must match cardIdUtils.ts and Python script)
const FILESYSTEM_REVERSE_MAP: Record<string, string> = {
  '_excl_': '!',
  '_qmark_': '?',
  '_star_': '*',
  '_lt_': '<',
  '_gt_': '>',
  '_quot_': '"',
  '_pipe_': '|',
  '_bslash_': '\\',
  '_slash_': '/',
  '_colon_': ':',
  '_pct_': '%',
};

interface CardImage {
  cardId: string;
  path: string;
}

interface CheckpointData {
  [cardId: string]: number[];
}

// Model singleton
let modelInstance: any = null;

/**
 * Convert filesystem filename back to card ID
 */
function filenameToCardId(filename: string): string {
  let result = filename;
  for (const [replacement, char] of Object.entries(FILESYSTEM_REVERSE_MAP)) {
    result = result.split(replacement).join(char);
  }
  return result;
}

/**
 * Scan card-images directory for all image files
 */
function scanCardImages(): CardImage[] {
  if (!fs.existsSync(CARD_IMAGES_DIR)) {
    throw new Error(`Card images directory not found: ${CARD_IMAGES_DIR}`);
  }

  const images: CardImage[] = [];
  const entries = fs.readdirSync(CARD_IMAGES_DIR);

  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase();
    if (SUPPORTED_EXTENSIONS.has(ext)) {
      const cardId = filenameToCardId(path.basename(entry, ext));
      images.push({
        cardId,
        path: path.join(CARD_IMAGES_DIR, entry),
      });
    }
  }

  return images;
}

/**
 * Load checkpoint if it exists
 */
function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    console.log('Loading checkpoint...');
    const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    console.log(`Loaded ${Object.keys(data).length} embeddings from checkpoint`);
    return data;
  }
  return {};
}

/**
 * Save checkpoint to JSON file
 */
function saveCheckpoint(embeddings: CheckpointData): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(embeddings));
  console.log(`Checkpoint saved: ${Object.keys(embeddings).length} cards`);
}

/**
 * Write embeddings to binary file (same format as Python script)
 */
function writeBinaryEmbeddings(embeddings: CheckpointData, outputPath: string): void {
  const cardIds: string[] = [];

  for (const cardId of Object.keys(embeddings)) {
    const cardIdBytes = Buffer.byteLength(cardId, 'utf-8');
    if (cardIdBytes > 255) {
      console.log(`Warning: Card ID too long, skipping: ${cardId}`);
      continue;
    }
    cardIds.push(cardId);
  }

  // Calculate total size
  let totalSize = 8; // header
  for (const cardId of cardIds) {
    const cardIdBytes = Buffer.byteLength(cardId, 'utf-8');
    totalSize += 1 + cardIdBytes + EMBEDDING_DIM * 4;
  }

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  // Header
  buffer.writeUInt32LE(cardIds.length, offset);
  offset += 4;
  buffer.writeUInt32LE(EMBEDDING_DIM, offset);
  offset += 4;

  // Embeddings
  for (const cardId of cardIds) {
    const embedding = embeddings[cardId];
    const cardIdBuf = Buffer.from(cardId, 'utf-8');

    buffer.writeUInt8(cardIdBuf.length, offset);
    offset += 1;
    cardIdBuf.copy(buffer, offset);
    offset += cardIdBuf.length;

    for (let i = 0; i < EMBEDDING_DIM; i++) {
      buffer.writeFloatLE(embedding[i], offset);
      offset += 4;
    }
  }

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, buffer);
  const sizeMB = totalSize / 1024 / 1024;
  console.log(`Wrote ${outputPath}: ${sizeMB.toFixed(2)} MB (${cardIds.length} cards)`);
}

/**
 * Load the model (singleton)
 */
async function loadModel(): Promise<any> {
  if (modelInstance) return modelInstance;

  console.log(`Loading model: ${MODEL_ID} (${DTYPE})...`);
  modelInstance = await pipeline('image-feature-extraction', MODEL_ID, {
    dtype: DTYPE,
  });
  console.log('Model loaded successfully\n');

  return modelInstance;
}

/**
 * Generate embedding for a single image
 */
async function getImageEmbedding(imagePath: string): Promise<number[]> {
  const model = await loadModel();
  const output = await model(imagePath, INFERENCE_OPTIONS);
  return Array.from(output.data as Float32Array);
}

/**
 * Find similar cards to a query image
 */
function findSimilar(
  queryEmbedding: number[],
  embeddings: CheckpointData,
  topK: number = 5
): Array<{ cardId: string; score: number }> {
  const results: Array<{ cardId: string; score: number }> = [];

  for (const [cardId, embedding] of Object.entries(embeddings)) {
    // Cosine similarity (vectors are already normalized, so dot product = cosine)
    let dot = 0;
    for (let i = 0; i < queryEmbedding.length; i++) {
      dot += queryEmbedding[i] * embedding[i];
    }
    results.push({ cardId, score: dot });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

/**
 * Load embeddings from binary file
 */
function loadEmbeddingsFromBinary(filePath: string): CheckpointData {
  const buffer = fs.readFileSync(filePath);
  let offset = 0;

  const cardCount = buffer.readUInt32LE(offset);
  offset += 4;
  const embeddingDim = buffer.readUInt32LE(offset);
  offset += 4;

  console.log(`Loading ${cardCount} embeddings (dim=${embeddingDim})...`);

  const embeddings: CheckpointData = {};

  for (let i = 0; i < cardCount; i++) {
    const cardIdLength = buffer.readUInt8(offset);
    offset += 1;

    const cardId = buffer.toString('utf-8', offset, offset + cardIdLength);
    offset += cardIdLength;

    const embedding: number[] = [];
    for (let j = 0; j < embeddingDim; j++) {
      embedding.push(buffer.readFloatLE(offset));
      offset += 4;
    }

    embeddings[cardId] = embedding;
  }

  return embeddings;
}

function printUsage(): void {
  console.log(`
MobileClip-S2 Embeddings Builder (TypeScript)

Usage:
  npm run embeddings:build:ts [options]
  npm run embeddings:search -- <image-path> [options]

Build Command:
  tsx scripts/build-embeddings-ts.ts --build [options]

  Options:
    --batch-size <n>         Process n images at a time (default: 1)
    --checkpoint-interval <n> Save checkpoint every n images (default: 100)

Search Command:
  tsx scripts/build-embeddings-ts.ts --search <image-path> [options]

  Options:
    --embeddings <path>      Path to embeddings file (default: public/embeddings.bin)
    --top <n>                Number of results (default: 10)

Examples:
  npm run embeddings:build:ts
  npm run embeddings:search -- ./test-card.jpg --top 5
`);
}

function parseArgs(): { command: string; options: Record<string, string> } {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  let command = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--build') {
      command = 'build';
    } else if (arg === '--search' && args[i + 1]) {
      command = 'search';
      options.imagePath = args[++i];
    } else if (arg === '--batch-size' && args[i + 1]) {
      options.batchSize = args[++i];
    } else if (arg === '--checkpoint-interval' && args[i + 1]) {
      options.checkpointInterval = args[++i];
    } else if (arg === '--embeddings' && args[i + 1]) {
      options.embeddings = args[++i];
    } else if (arg === '--top' && args[i + 1]) {
      options.top = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      command = 'help';
    }
  }

  // Default to build if no command specified
  if (!command && args.length === 0) {
    command = 'build';
  }

  return { command, options };
}

async function runBuild(options: Record<string, string>): Promise<void> {
  const checkpointInterval = parseInt(options.checkpointInterval || '100', 10);
  const outputPath = options.output || OUTPUT_FILE;

  console.log('=== Embeddings Build Script (TypeScript/transformers.js) ===\n');
  console.log(`Model: ${MODEL_ID} (${DTYPE})`);
  console.log(`Pooling: ${INFERENCE_OPTIONS.pooling}`);
  console.log(`Normalize: ${INFERENCE_OPTIONS.normalize}`);
  console.log(`Output: ${outputPath}\n`);

  // Scan for images
  console.log('Scanning for card images...');
  const allCards = scanCardImages();
  console.log(`Found ${allCards.length} card images\n`);

  if (allCards.length === 0) {
    console.log('No card images found. Run download-all-cards.ts first.');
    process.exit(1);
  }

  // Load checkpoint
  const embeddings = loadCheckpoint();
  const processedIds = new Set(Object.keys(embeddings));

  // Filter to unprocessed
  const toProcess = allCards.filter((card) => !processedIds.has(card.cardId));
  console.log(`Already processed: ${processedIds.size}`);
  console.log(`To process: ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log('All cards already processed!');
  } else {
    // Load model
    await loadModel();

    let failed = 0;
    let checkpointCounter = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const card = toProcess[i];
      const progress = `[${i + 1}/${toProcess.length}]`;

      try {
        process.stdout.write(`${progress} Processing: ${card.cardId}...`);
        const embedding = await getImageEmbedding(card.path);
        embeddings[card.cardId] = embedding;
        process.stdout.write(' done\n');
      } catch (error) {
        process.stdout.write(` FAILED: ${error}\n`);
        failed++;
      }

      // Checkpoint
      checkpointCounter++;
      if (checkpointCounter >= checkpointInterval) {
        saveCheckpoint(embeddings);
        checkpointCounter = 0;
      }
    }

    console.log(`\nProcessed: ${toProcess.length - failed}`);
    console.log(`Failed: ${failed}`);
  }

  // Write binary output
  console.log('\nWriting binary embeddings file...');
  writeBinaryEmbeddings(embeddings, outputPath);

  // Cleanup checkpoint
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log('Checkpoint file removed.');
  }

  console.log('\nDone!');
}

async function runSearch(options: Record<string, string>): Promise<void> {
  const imagePath = options.imagePath;
  const embeddingsPath = options.embeddings || OUTPUT_FILE;
  const topK = parseInt(options.top || '10', 10);

  if (!imagePath) {
    console.error('Error: No image path provided');
    process.exit(1);
  }

  console.log(`Searching for similar cards to: ${imagePath}\n`);

  // Load embeddings
  if (!fs.existsSync(embeddingsPath)) {
    console.error(`Embeddings file not found: ${embeddingsPath}`);
    console.error('Run "npm run embeddings:build:ts" first.');
    process.exit(1);
  }

  const embeddings = loadEmbeddingsFromBinary(embeddingsPath);
  console.log(`Loaded ${Object.keys(embeddings).length} embeddings\n`);

  // Generate embedding for query image
  console.log('Generating embedding for query image...');
  const queryEmbedding = await getImageEmbedding(imagePath);

  // Find similar cards
  console.log(`\nTop ${topK} similar cards:\n`);
  const results = findSimilar(queryEmbedding, embeddings, topK);

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.cardId}`);
    console.log(`   Score: ${result.score.toFixed(4)}`);
    console.log();
  });
}

async function main(): Promise<void> {
  const { command, options } = parseArgs();

  try {
    switch (command) {
      case 'build':
        await runBuild(options);
        break;

      case 'search':
        await runSearch(options);
        break;

      case 'help':
        printUsage();
        break;

      default:
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
