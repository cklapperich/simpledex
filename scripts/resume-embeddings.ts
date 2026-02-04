#!/usr/bin/env node
/**
 * Resume embeddings build from checkpoint
 * Use this if the build script was interrupted
 *
 * Usage:
 *   npx tsx scripts/resume-embeddings.ts
 *   npx tsx scripts/resume-embeddings.ts --upload  # Also upload to Supabase after completion
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
const CHECKPOINT_INTERVAL = 10;
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
  console.log(`Loading model: ${MODEL_ID}...`);
  model = await pipeline('image-feature-extraction', MODEL_ID);
  console.log('Model loaded successfully');
  return model;
}

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

function loadCheckpoint(): Map<string, Float32Array> {
  const embeddings = new Map<string, Float32Array>();

  if (!fs.existsSync(CHECKPOINT_FILE)) {
    console.log('No checkpoint file found. Starting fresh.');
    return embeddings;
  }

  console.log('Loading checkpoint...');
  const data: CheckpointData = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));

  for (const [cardId, arr] of Object.entries(data)) {
    embeddings.set(cardId, new Float32Array(arr));
  }

  console.log(`Loaded ${embeddings.size} embeddings from checkpoint`);
  return embeddings;
}

function saveCheckpoint(embeddings: Map<string, Float32Array>): void {
  const data: CheckpointData = {};
  for (const [cardId, embedding] of embeddings) {
    data[cardId] = Array.from(embedding);
  }
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data));
  console.log(`Checkpoint saved: ${embeddings.size} cards`);
}

function writeBinaryEmbeddings(
  embeddings: Map<string, Float32Array>,
  outputPath: string
): void {
  const cardIds = Array.from(embeddings.keys()).filter(cardId => {
    const cardIdBytes = Buffer.byteLength(cardId, 'utf-8');
    if (cardIdBytes > 255) {
      console.warn(`Card ID too long (${cardIdBytes} bytes), skipping: ${cardId}`);
      return false;
    }
    return true;
  });

  let totalSize = 8;
  for (const cardId of cardIds) {
    const cardIdBytes = Buffer.byteLength(cardId, 'utf-8');
    totalSize += 1 + cardIdBytes + (EMBEDDING_DIM * 4);
  }

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  buffer.writeUInt32LE(cardIds.length, offset); offset += 4;
  buffer.writeUInt32LE(EMBEDDING_DIM, offset); offset += 4;

  for (const cardId of cardIds) {
    const embedding = embeddings.get(cardId)!;
    const cardIdBytes = Buffer.byteLength(cardId, 'utf-8');

    buffer.writeUInt8(cardIdBytes, offset); offset += 1;
    buffer.write(cardId, offset, 'utf-8'); offset += cardIdBytes;

    for (let i = 0; i < EMBEDDING_DIM; i++) {
      buffer.writeFloatLE(embedding[i], offset); offset += 4;
    }
  }

  fs.writeFileSync(outputPath, buffer);
  const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${outputPath}: ${sizeMB} MB (${cardIds.length} cards)`);
}

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

  console.log('=== Resume Embeddings Build ===\n');

  // 1. Load checkpoint
  const embeddings = loadCheckpoint();
  const processedIds = new Set(embeddings.keys());

  // 2. Scan for all card images
  console.log('\nScanning for card images...');
  const allCards = scanCardImages();
  console.log(`Found ${allCards.length} total card images`);

  // 3. Find unprocessed cards
  const toProcess = allCards.filter(c => !processedIds.has(c.cardId));
  console.log(`Already processed: ${processedIds.size}`);
  console.log(`Remaining: ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log('All cards already processed!');
  } else {
    // 4. Load model and continue processing
    await loadModel();

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

      const elapsed = Date.now() - startTime;
      const rate = processed / (elapsed / 1000);
      const remaining = (toProcess.length - processed - failed) / rate;
      console.log(`  Progress: ${processed}/${toProcess.length} | ${rate.toFixed(1)}/s | ETA: ${formatTime(remaining * 1000)}`);

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

  // 6. Optionally upload
  if (shouldUpload) {
    try {
      await uploadToSupabase(OUTPUT_FILE);
    } catch (error) {
      console.error('Upload failed:', error instanceof Error ? error.message : error);
    }
  }

  // 7. Cleanup checkpoint
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log('\nCheckpoint file removed.');
  }

  console.log('\nDone!');
}

main().catch(error => {
  console.error('Resume failed:', error);
  process.exit(1);
});
