#!/usr/bin/env node
/**
 * Incremental embeddings update
 * Processes only new cards that aren't in the existing embeddings file
 *
 * Usage:
 *   npx tsx scripts/update-embeddings.ts
 *   npx tsx scripts/update-embeddings.ts --upload
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
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'public', 'embeddings.bin');
const CARD_IMAGES_DIR = path.join(PROJECT_ROOT, 'card-images');
const EMBEDDING_DIM = 512;

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

interface CardImage {
  cardId: string;
  imagePath: string;
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

function readBinaryEmbeddings(inputPath: string): Map<string, Float32Array> {
  if (!fs.existsSync(inputPath)) {
    return new Map();
  }

  const buffer = fs.readFileSync(inputPath);
  const embeddings = new Map<string, Float32Array>();
  let offset = 0;

  const numCards = buffer.readUInt32LE(offset); offset += 4;
  const dim = buffer.readUInt32LE(offset); offset += 4;

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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldUpload = args.includes('--upload');

  console.log('=== Incremental Embeddings Update ===\n');

  // 1. Load existing embeddings
  console.log('Loading existing embeddings...');
  const embeddings = readBinaryEmbeddings(OUTPUT_FILE);
  const existingIds = new Set(embeddings.keys());
  console.log(`Existing embeddings: ${existingIds.size}`);

  // 2. Scan for all card images
  console.log('\nScanning for card images...');
  const allCards = scanCardImages();
  console.log(`Total card images: ${allCards.length}`);

  // 3. Find new cards
  const newCards = allCards.filter(c => !existingIds.has(c.cardId));
  console.log(`New cards to process: ${newCards.length}\n`);

  if (newCards.length === 0) {
    console.log('No new cards found. Embeddings are up to date!');
    return;
  }

  // 4. Load model and generate embeddings for new cards
  await loadModel();

  let processed = 0;
  let failed = 0;

  for (const card of newCards) {
    try {
      const output = await model(card.imagePath, {
        pooling: 'mean',
        normalize: true
      });
      embeddings.set(card.cardId, new Float32Array(output.data));
      processed++;

      if (processed % 50 === 0) {
        console.log(`Progress: ${processed}/${newCards.length}`);
      }
    } catch (error) {
      console.error(`Failed: ${card.cardId}:`, error instanceof Error ? error.message : error);
      failed++;
    }
  }

  console.log(`\nProcessed: ${processed}`);
  console.log(`Failed: ${failed}`);

  // 5. Write updated binary file
  console.log('\nWriting updated embeddings file...');
  writeBinaryEmbeddings(embeddings, OUTPUT_FILE);

  // 6. Optionally upload
  if (shouldUpload) {
    try {
      await uploadToSupabase(OUTPUT_FILE);
    } catch (error) {
      console.error('Upload failed:', error instanceof Error ? error.message : error);
    }
  }

  console.log('\nDone!');
}

main().catch(error => {
  console.error('Update failed:', error);
  process.exit(1);
});
