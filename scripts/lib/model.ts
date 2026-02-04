/**
 * Shared model utilities for CLI scripts (Node.js environment)
 */
import { pipeline } from '@huggingface/transformers';
import { MODEL_ID, DTYPE, INFERENCE_OPTIONS } from '../../src/config/model-config.js';
import { preprocessImage, logPreprocessingConfig } from '../../src/lib/preprocessing.js';

let model: any = null;

export async function loadModel(): Promise<any> {
  if (model) return model;
  console.log(`Loading model: ${MODEL_ID} (${DTYPE})...`);
  logPreprocessingConfig();
  model = await pipeline('image-feature-extraction', MODEL_ID, { dtype: DTYPE });
  console.log('Model loaded successfully');
  return model;
}

export async function getImageEmbedding(imagePath: string): Promise<Float32Array> {
  const m = await loadModel();
  const processedImage = await preprocessImage(imagePath);
  const output = await m(processedImage, INFERENCE_OPTIONS);
  const embedding = new Float32Array(output.data);

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) {
    norm += embedding[i] * embedding[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 1e-12) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }
  }
  return embedding;
}
