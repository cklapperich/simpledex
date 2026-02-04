import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { EmbeddingDatabase, CardEmbedding } from './types.js';
import { MODEL_ID } from '../config/model-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_STORAGE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'embeddings.bin'
);

/**
 * Save embeddings database to binary file (matches Python format)
 */
function saveEmbeddingsBinary(database: EmbeddingDatabase, outputPath: string): void {
  const embeddings = database.embeddings;
  const embeddingDim = embeddings[0]?.embedding.length || 512;

  // Calculate total size
  let totalSize = 8; // header: cardCount (4) + embeddingDim (4)
  for (const e of embeddings) {
    const cardIdBytes = Buffer.byteLength(e.cardId, 'utf-8');
    totalSize += 1 + cardIdBytes + embeddingDim * 4;
  }

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  // Header
  buffer.writeUInt32LE(embeddings.length, offset);
  offset += 4;
  buffer.writeUInt32LE(embeddingDim, offset);
  offset += 4;

  // Embeddings
  for (const e of embeddings) {
    const cardIdBytes = Buffer.from(e.cardId, 'utf-8');
    buffer.writeUInt8(cardIdBytes.length, offset);
    offset += 1;
    cardIdBytes.copy(buffer, offset);
    offset += cardIdBytes.length;

    for (let j = 0; j < embeddingDim; j++) {
      buffer.writeFloatLE(e.embedding[j], offset);
      offset += 4;
    }
  }

  fs.writeFileSync(outputPath, buffer);
  const sizeMB = totalSize / 1024 / 1024;
  console.log(`Saved binary embeddings to: ${outputPath}`);
  console.log(`  - ${embeddings.length} embeddings`);
  console.log(`  - File size: ${sizeMB.toFixed(2)} MB`);
}

/**
 * Save embeddings database (auto-detects format by extension)
 */
export function saveEmbeddings(
  database: EmbeddingDatabase,
  outputPath: string = path.join(__dirname, 'data', 'embeddings.json')
): void {
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const ext = path.extname(outputPath).toLowerCase();

  if (ext === '.bin') {
    saveEmbeddingsBinary(database, outputPath);
  } else {
    const json = JSON.stringify(database, null, 2);
    fs.writeFileSync(outputPath, json, 'utf-8');

    console.log(`Saved embeddings to: ${outputPath}`);
    console.log(`  - ${database.embeddings.length} embeddings`);
    console.log(`  - File size: ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
  }
}

/**
 * Parse binary embeddings format (matches Python build-embeddings.py output)
 */
function parseEmbeddingsBinary(buffer: Buffer): EmbeddingDatabase {
  let offset = 0;

  // Header: 4 bytes (uint32 card count) + 4 bytes (uint32 embedding dim)
  const cardCount = buffer.readUInt32LE(offset);
  offset += 4;
  const embeddingDim = buffer.readUInt32LE(offset);
  offset += 4;

  console.log(`  - Card count: ${cardCount}`);
  console.log(`  - Embedding dim: ${embeddingDim}`);

  const embeddings: CardEmbedding[] = [];

  for (let i = 0; i < cardCount; i++) {
    // 1 byte (uint8 cardId length)
    const cardIdLength = buffer.readUInt8(offset);
    offset += 1;

    // N bytes (cardId string, UTF-8)
    const cardId = buffer.toString('utf-8', offset, offset + cardIdLength);
    offset += cardIdLength;

    // embeddingDim x float32 embedding
    const embedding: number[] = [];
    for (let j = 0; j < embeddingDim; j++) {
      embedding.push(buffer.readFloatLE(offset));
      offset += 4;
    }

    embeddings.push({
      cardId,
      embedding,
      imagePath: '' // Binary format doesn't store paths
    });
  }

  return {
    version: '1.0',
    modelId: MODEL_ID,
    createdAt: new Date().toISOString(),
    embeddings
  };
}

/**
 * Load embeddings database from file (supports both JSON and binary formats)
 */
export function loadEmbeddings(
  inputPath: string = DEFAULT_STORAGE_PATH
): EmbeddingDatabase {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Embeddings file not found: ${inputPath}`);
  }

  console.log(`Loading embeddings from: ${inputPath}`);

  // Detect format by extension
  const ext = path.extname(inputPath).toLowerCase();

  if (ext === '.bin') {
    // Binary format
    const buffer = fs.readFileSync(inputPath);
    const database = parseEmbeddingsBinary(buffer);
    console.log(`  - ${database.embeddings.length} embeddings loaded`);
    return database;
  } else {
    // JSON format
    const json = fs.readFileSync(inputPath, 'utf-8');
    const database: EmbeddingDatabase = JSON.parse(json);

    console.log(`  - Model: ${database.modelId}`);
    console.log(`  - ${database.embeddings.length} embeddings`);
    console.log(`  - Created: ${database.createdAt}`);

    return database;
  }
}

/**
 * Get the default storage path
 */
export function getDefaultStoragePath(): string {
  return DEFAULT_STORAGE_PATH;
}
