#!/usr/bin/env node
/**
 * Build embeddings database from local card images
 * Generates MobileClip embeddings and stores in binary format
 *
 * Usage:
 *   npx tsx scripts/build-embeddings.ts
 *   npx tsx scripts/build-embeddings.ts --upload  # Also upload to Supabase
 */
import { pipeline } from '@huggingface/transformers';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { filenameToCardId } from '../src/utils/cardIdUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const MODEL_ID = 'Xenova/mobileclip_s2';
const BATCH_SIZE = 50;
const CHECKPOINT_INTERVAL = 10; // Save checkpoint every N batches
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'public', 'embeddings.bin');
const CHECKPOINT_FILE = path.join(PROJECT_ROOT, 'embeddings-checkpoint.json');
const CARD_IMAGES_DIR = path.join(PROJECT_ROOT, 'card-images');
const EMBEDDING_DIM = 512;

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

interface CardImage {
  cardId: string;
  imagePath: string;
}

interface CheckpointData {
  [cardId: string]: number[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null;

async function loadModel(): Promise<any> {
  if (model) return model;
  console.log(`Loading model: ${MODEL_ID} (fp32)...`);
  model = await pipeline('image-feature-extraction', MODEL_ID, {
    dtype: 'fp32' // Must match browser and Python scripts
  });
  console.log('Model loaded successfully');
  return model;
}

/**
 * Scan card-images directory for all image files
 */
function scanCardImages(): CardImage[] {
  if (!fs.existsSync(CARD_IMAGES_DIR)) {
    throw new Error(`Card images directory not found: ${CARD_IMAGES_DIR}`);
  }

  const files = fs.readdirSync(CARD_IMAGES_DIR);
  const images: CardImage[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

    const baseName = path.basename(file, ext);
    const cardId = filenameToCardId(baseName);
    const imagePath = path.join(CARD_IMAGES_DIR, file);

    images.push({ cardId, imagePath });
  }

  return images;
}

/**
 * Load checkpoint if it exists
 */
function loadCheckpoint(): Map<string, Float32Array> {
  const embeddings = new Map<string, Float32Array>();

  if (fs.existsSync(CHECKPOINT_FILE)) {
    console.log('Loading checkpoint...');
    const data: CheckpointData = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    for (const [cardId, arr] of Object.entries(data)) {
      embeddings.set(cardId, new Float32Array(arr));
    }
    console.log(`Loaded ${embeddings.size} embeddings from checkpoint`);
  }

  return embeddings;
}

/**
 * Save checkpoint to JSON file
 */
function saveCheckpoint(embeddings: Map<string, Float32Array>): void {
  const data: CheckpointData = {};
  for (const [cardId, embedding] of embeddings) {
    data[cardId] = Array.from(embedding);
  }
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data));
  console.log(`Checkpoint saved: ${embeddings.size} cards`);
}

/**
 * Write embeddings to binary file
 *
 * Format:
 * Header:
 *   - 4 bytes: uint32 - number of cards
 *   - 4 bytes: uint32 - embedding dimension (512)
 * Per card:
 *   - 1 byte: uint8 - cardId string length
 *   - N bytes: UTF-8 cardId string
 *   - 2048 bytes: 512 x float32 embedding
 */
function writeBinaryEmbeddings(
  embeddings: Map<string, Float32Array>,
  outputPath: string
): void {
  const cardIds = Array.from(embeddings.keys());

  // Calculate total size
  let totalSize = 8; // header
  for (const cardId of cardIds) {
    const cardIdBytes = Buffer.byteLength(cardId, 'utf-8');
    if (cardIdBytes > 255) {
      console.warn(`Card ID too long (${cardIdBytes} bytes), skipping: ${cardId}`);
      continue;
    }
    totalSize += 1 + cardIdBytes + (EMBEDDING_DIM * 4);
  }

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  // Write header
  buffer.writeUInt32LE(cardIds.length, offset); offset += 4;
  buffer.writeUInt32LE(EMBEDDING_DIM, offset); offset += 4;

  // Write each card
  for (const cardId of cardIds) {
    const embedding = embeddings.get(cardId)!;
    const cardIdBytes = Buffer.byteLength(cardId, 'utf-8');

    if (cardIdBytes > 255) continue;

    // CardId length + string
    buffer.writeUInt8(cardIdBytes, offset); offset += 1;
    buffer.write(cardId, offset, 'utf-8'); offset += cardIdBytes;

    // Embedding floats
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      buffer.writeFloatLE(embedding[i], offset); offset += 4;
    }
  }

  fs.writeFileSync(outputPath, buffer);
  const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${outputPath}: ${sizeMB} MB (${cardIds.length} cards)`);
}

/**
 * Read binary embeddings file
 */
function readBinaryEmbeddings(inputPath: string): Map<string, Float32Array> {
  const buffer = fs.readFileSync(inputPath);
  const embeddings = new Map<string, Float32Array>();
  let offset = 0;

  // Read header
  const numCards = buffer.readUInt32LE(offset); offset += 4;
  const dim = buffer.readUInt32LE(offset); offset += 4;

  console.log(`Reading ${numCards} cards with ${dim}-dim embeddings`);

  // Read each card
  for (let i = 0; i < numCards; i++) {
    const cardIdLen = buffer.readUInt8(offset); offset += 1;
    const cardId = buffer.toString('utf-8', offset, offset + cardIdLen); offset += cardIdLen;

    const embedding = new Float32Array(dim);
    for (let j = 0; j < dim; j++) {
      embedding[j] = buffer.readFloatLE(offset); offset += 4;
    }

    embeddings.set(cardId, embedding);
  }

  return embeddings;
}

/**
 * Upload embeddings to Supabase Storage
 */
async function uploadToSupabase(filePath: string): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const fileBuffer = fs.readFileSync(filePath);

  console.log('Uploading to Supabase Storage...');

  const { error } = await supabase.storage
    .from('scanner')
    .upload('embeddings.bin', fileBuffer, {
      contentType: 'application/octet-stream',
      upsert: true
    });

  if (error) throw error;

  const { data } = supabase.storage.from('scanner').getPublicUrl('embeddings.bin');
  console.log(`Uploaded to: ${data.publicUrl}`);

  return data.publicUrl;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldUpload = args.includes('--upload');

  console.log('=== Embeddings Build Script ===\n');

  // 1. Scan for card images
  console.log('Scanning for card images...');
  const cards = scanCardImages();
  console.log(`Found ${cards.length} card images\n`);

  if (cards.length === 0) {
    console.error('No card images found. Run download-all-cards.ts first.');
    process.exit(1);
  }

  // 2. Load model
  await loadModel();

  // 3. Load checkpoint if exists
  const embeddings = loadCheckpoint();
  const processedIds = new Set(embeddings.keys());

  // Filter to unprocessed cards
  const toProcess = cards.filter(c => !processedIds.has(c.cardId));
  console.log(`Already processed: ${processedIds.size}`);
  console.log(`To process: ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log('All cards already processed!');
  } else {
    // 4. Process in batches
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);

      console.log(`Processing batch ${batchNum}/${totalBatches}...`);

      for (const card of batch) {
        try {
          const output = await model(card.imagePath, {
            pooling: 'mean',
            normalize: true
          });
          embeddings.set(card.cardId, new Float32Array(output.data));
          processed++;
        } catch (error) {
          console.error(`  Failed: ${card.cardId}:`, error instanceof Error ? error.message : error);
          failed++;
        }
      }

      // Progress update
      const elapsed = Date.now() - startTime;
      const rate = processed / (elapsed / 1000);
      const remaining = (toProcess.length - processed - failed) / rate;
      console.log(`  Progress: ${processed}/${toProcess.length} | ${rate.toFixed(1)}/s | ETA: ${formatTime(remaining * 1000)}`);

      // Save checkpoint periodically
      if (batchNum % CHECKPOINT_INTERVAL === 0) {
        saveCheckpoint(embeddings);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`\nProcessing complete in ${formatTime(totalTime)}`);
    console.log(`  Processed: ${processed}`);
    console.log(`  Failed: ${failed}`);
  }

  // 5. Write binary output
  console.log('\nWriting binary embeddings file...');
  writeBinaryEmbeddings(embeddings, OUTPUT_FILE);

  // 6. Optionally upload to Supabase
  if (shouldUpload) {
    try {
      await uploadToSupabase(OUTPUT_FILE);
    } catch (error) {
      console.error('Upload failed:', error instanceof Error ? error.message : error);
      console.log('Binary file is still available locally.');
    }
  }

  // 7. Cleanup checkpoint
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log('\nCheckpoint file removed.');
  }

  console.log('\nDone!');
}

// Export for use in other scripts
export { readBinaryEmbeddings, writeBinaryEmbeddings };

main().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
