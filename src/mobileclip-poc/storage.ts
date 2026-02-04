import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { EmbeddingDatabase } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_STORAGE_PATH = path.join(
  __dirname,
  'data',
  'embeddings.json'
);

/**
 * Save embeddings database to JSON file
 */
export function saveEmbeddings(
  database: EmbeddingDatabase,
  outputPath: string = DEFAULT_STORAGE_PATH
): void {
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const json = JSON.stringify(database, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');

  console.log(`Saved embeddings to: ${outputPath}`);
  console.log(`  - ${database.embeddings.length} embeddings`);
  console.log(`  - File size: ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
}

/**
 * Load embeddings database from JSON file
 */
export function loadEmbeddings(
  inputPath: string = DEFAULT_STORAGE_PATH
): EmbeddingDatabase {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Embeddings file not found: ${inputPath}`);
  }

  const json = fs.readFileSync(inputPath, 'utf-8');
  const database: EmbeddingDatabase = JSON.parse(json);

  console.log(`Loaded embeddings from: ${inputPath}`);
  console.log(`  - Model: ${database.modelId}`);
  console.log(`  - ${database.embeddings.length} embeddings`);
  console.log(`  - Created: ${database.createdAt}`);

  return database;
}

/**
 * Get the default storage path
 */
export function getDefaultStoragePath(): string {
  return DEFAULT_STORAGE_PATH;
}
