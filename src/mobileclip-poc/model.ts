import { pipeline } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/mobileclip_s2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelInstance: any = null;

/**
 * Load the MobileClip-S2 model (singleton pattern)
 */
export async function loadModel(): Promise<any> {
  if (modelInstance) {
    return modelInstance;
  }

  console.log(`Loading model: ${MODEL_ID}...`);
  modelInstance = await pipeline('image-feature-extraction', MODEL_ID);
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
  const output = await model(imagePath, { pooling: 'mean', normalize: true });

  // Convert Tensor to regular array
  const embedding = Array.from(output.data as Float32Array);
  return embedding;
}
