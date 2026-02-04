import { pipeline } from '@huggingface/transformers';
import { MODEL_ID, DTYPE, INFERENCE_OPTIONS } from '../config/model-config';
import { preprocessImage, logPreprocessingConfig } from '../lib/preprocessing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelInstance: any = null;

/**
 * Load the MobileClip-S2 model (singleton pattern)
 */
export async function loadModel(): Promise<any> {
  if (modelInstance) {
    return modelInstance;
  }

  console.log(`Loading model: ${MODEL_ID} (${DTYPE})...`);
  logPreprocessingConfig();

  modelInstance = await pipeline('image-feature-extraction', MODEL_ID, {
    dtype: DTYPE
  });
  console.log('Model loaded successfully');

  return modelInstance;
}

/**
 * Get the model ID being used
 */
export function getModelId(): string {
  return MODEL_ID;
}

/**
 * Generate embedding for a single image
 * @param imagePath - Path to the image file
 * @returns 512-dimensional embedding vector
 */
export async function getImageEmbedding(imagePath: string): Promise<number[]> {
  const model = await loadModel();

  // Use shared preprocessing
  const processedImage = await preprocessImage(imagePath);

  // Run inference
  const output = await model(processedImage, INFERENCE_OPTIONS);

  // Convert Tensor to regular array
  const embedding = Array.from(output.data as Float32Array);

  // L2 normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  const normalized = embedding.map(v => v / Math.max(norm, 1e-12));

  return normalized;
}
