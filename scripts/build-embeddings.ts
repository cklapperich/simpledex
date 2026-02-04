#!/usr/bin/env tsx
/**
 * Build embeddings database from local card images using transformers.js
 *
 * Usage:
 *   npm run embeddings:build
 *   npm run embeddings:build -- --checkpoint-interval 50
 *
 * For searching/testing inference, use: npm run test:inference
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { MODEL_CONFIG, MODEL_ID, DTYPE, INFERENCE_OPTIONS, EMBEDDING_DIM } from '../src/config/model-config.js';
import { loadModel, getImageEmbedding } from './lib/model.js';

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

function printUsage(): void {
  console.log(`
MobileClip-S2 Embeddings Builder

Usage:
  npm run embeddings:build [options]

Options:
  --checkpoint-interval <n>  Save checkpoint every n images (default: 100)
  --output <path>            Output file path (default: public/embeddings.bin)
  --help                     Show this help message

For testing inference on a single image:
  npm run test:inference -- <image-path>

Examples:
  npm run embeddings:build
  npm run embeddings:build -- --checkpoint-interval 50
`);
}

function parseArgs(): { options: Record<string, string>; showHelp: boolean } {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--checkpoint-interval' && args[i + 1]) {
      options.checkpointInterval = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      showHelp = true;
    }
  }

  return { options, showHelp };
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

async function main(): Promise<void> {
  const { options, showHelp } = parseArgs();

  if (showHelp) {
    printUsage();
    return;
  }

  try {
    await runBuild(options);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
