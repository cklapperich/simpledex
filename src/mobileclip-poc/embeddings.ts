import * as fs from 'fs';
import * as path from 'path';
import { getImageEmbedding, getModelId } from './model.js';
import type { CardEmbedding, EmbeddingDatabase } from './types.js';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Extract card ID from filename
 * Assumes filename format like "cardId.jpg" or "cardId_variant.png"
 */
function extractCardId(filename: string): string {
  const baseName = path.basename(filename, path.extname(filename));
  // Remove any variant suffixes (e.g., "_holo", "_reverse")
  return baseName.split('_')[0];
}

/**
 * Scan directory for supported image files
 */
function scanImageDirectory(dirPath: string): string[] {
  const files: string[] = [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      files.push(...scanImageDirectory(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Build embeddings from all images in a directory
 */
export async function buildEmbeddings(imageDir: string): Promise<EmbeddingDatabase> {
  console.log(`Scanning directory: ${imageDir}`);
  const imagePaths = scanImageDirectory(imageDir);
  console.log(`Found ${imagePaths.length} images`);

  if (imagePaths.length === 0) {
    throw new Error(`No supported images found in ${imageDir}`);
  }

  const embeddings: CardEmbedding[] = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    const cardId = extractCardId(imagePath);

    console.log(`[${i + 1}/${imagePaths.length}] Processing: ${path.basename(imagePath)}`);

    try {
      const embedding = await getImageEmbedding(imagePath);
      embeddings.push({
        cardId,
        embedding,
        imagePath,
      });
    } catch (error) {
      console.error(`  Error processing ${imagePath}:`, error);
    }
  }

  console.log(`Successfully generated ${embeddings.length} embeddings`);

  return {
    version: '1.0.0',
    modelId: getModelId(),
    createdAt: new Date().toISOString(),
    embeddings,
  };
}
