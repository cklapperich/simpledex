/**
 * Shared image preprocessing utilities for MobileClip embeddings.
 * Used by both embedding generation (build) and inference (search).
 *
 * IMPORTANT: Any changes here affect both build and query pipelines.
 * After modifying, rebuild embeddings to maintain consistency.
 */

import { RawImage } from '@huggingface/transformers';
import { MODEL_CONFIG } from '../config/model-config';

export type CropMethod = 'top' | 'center' | 'none';

export interface PreprocessingOptions {
  cropMethod?: CropMethod;
  imageSize?: number;
}

/**
 * Get default preprocessing options from config
 */
export function getDefaultOptions(): Required<PreprocessingOptions> {
  return {
    cropMethod: (MODEL_CONFIG.preprocessing.cropMethod as CropMethod) || 'none',
    imageSize: MODEL_CONFIG.preprocessing.imageSize || 256
  };
}

/**
 * Apply crop and resize to a RawImage
 */
async function applyCropAndResize(
  image: RawImage,
  options: Required<PreprocessingOptions>
): Promise<RawImage> {
  const { width, height } = image;
  const { cropMethod, imageSize } = options;

  let processed: RawImage = image;

  // Apply crop if needed
  if (cropMethod !== 'none' && width !== height) {
    const squareSize = Math.min(width, height);
    let cropX: number;
    let cropY: number;

    if (cropMethod === 'top') {
      // Top-crop: center horizontally, start from top
      cropX = Math.floor((width - squareSize) / 2);
      cropY = 0;
    } else {
      // Center-crop: center both axes
      cropX = Math.floor((width - squareSize) / 2);
      cropY = Math.floor((height - squareSize) / 2);
    }

    processed = await image.crop([cropX, cropY, cropX + squareSize, cropY + squareSize]);
  }

  // Resize to model input size
  const resized = await processed.resize(imageSize, imageSize);
  return resized;
}

/**
 * Preprocess an image from a file path or URL.
 * Used by POC/CLI tools.
 *
 * @param imagePath - Path to image file or URL
 * @param options - Override default preprocessing options
 * @returns Preprocessed RawImage ready for model inference
 */
export async function preprocessImage(
  imagePath: string,
  options?: PreprocessingOptions
): Promise<RawImage> {
  const opts = { ...getDefaultOptions(), ...options };
  const image = await RawImage.fromURL(imagePath);
  return applyCropAndResize(image, opts);
}

/**
 * Preprocess an image from a Blob.
 * Used by browser scanner.
 *
 * @param blob - Image blob (e.g., from camera capture)
 * @param options - Override default preprocessing options
 * @returns Preprocessed RawImage ready for model inference
 */
export async function preprocessBlob(
  blob: Blob,
  options?: PreprocessingOptions
): Promise<RawImage> {
  const opts = { ...getDefaultOptions(), ...options };
  const url = URL.createObjectURL(blob);

  try {
    const image = await RawImage.fromURL(url);
    return applyCropAndResize(image, opts);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Log preprocessing info for debugging
 */
export function logPreprocessingConfig(): void {
  const opts = getDefaultOptions();
  console.log(`Preprocessing config:`);
  console.log(`  - Crop method: ${opts.cropMethod}`);
  console.log(`  - Image size: ${opts.imageSize}x${opts.imageSize}`);
}
