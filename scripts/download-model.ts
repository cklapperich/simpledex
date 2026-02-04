/**
 * Download model files from HuggingFace to public/model/
 * Run during CI/build, not at runtime
 *
 * Usage: npx tsx scripts/download-model.ts
 */

import { mkdir, writeFile, access, unlink } from 'fs/promises';
import { join } from 'path';
import { MODEL_ID } from '../src/config/model-config';

const HF_BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/main`;
const OUTPUT_DIR = join(process.cwd(), 'public', 'model');

// Files needed for transformers.js to load the vision model
const MODEL_FILES = [
  'config.json',
  'preprocessor_config.json',
  'onnx/vision_model.onnx',
  'onnx/vision_model_quantized.onnx',
];

async function downloadFile(filename: string): Promise<void> {
  const url = `${HF_BASE_URL}/${filename}`;
  const outputPath = join(OUTPUT_DIR, filename);

  // Ensure directory exists
  const dir = outputPath.substring(0, outputPath.lastIndexOf('/'));
  await mkdir(dir, { recursive: true });

  console.log(`Downloading ${filename}...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'simpledex-model-downloader'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${filename}: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await writeFile(outputPath, Buffer.from(buffer));

  const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(2);
  console.log(`  Downloaded ${filename} (${sizeMB} MB)`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log(`Downloading model files from ${MODEL_ID}...`);
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  // Create output directory
  await mkdir(OUTPUT_DIR, { recursive: true });

  const forceDownload = process.argv.includes('--force');

  for (const file of MODEL_FILES) {
    const outputPath = join(OUTPUT_DIR, file);

    if (!forceDownload && await fileExists(outputPath)) {
      console.log(`Skipping ${file} (already exists, use --force to re-download)`);
      continue;
    }

    try {
      await downloadFile(file);
    } catch (error) {
      // Some files may not exist (like quantized model), skip them
      if (error instanceof Error && error.message.includes('404')) {
        console.log(`  Skipping ${file} (not found on HuggingFace)`);
        // Clean up partial file if it exists
        if (await fileExists(outputPath)) {
          await unlink(outputPath);
        }
      } else {
        throw error;
      }
    }
  }

  console.log('\nModel download complete!');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
