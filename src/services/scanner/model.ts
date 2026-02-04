import { pipeline, env } from '@huggingface/transformers';
import { MODEL_ID, DTYPE, INFERENCE_OPTIONS } from '../../config/model-config';
import { preprocessBlob } from '../../lib/preprocessing';

// Configure for browser
env.allowLocalModels = false;
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelInstance: any = null;

export async function loadModel(onProgress?: (percent: number) => void): Promise<void> {
  if (modelInstance) return;

  modelInstance = await pipeline('image-feature-extraction', MODEL_ID, {
    dtype: DTYPE,
    progress_callback: (data: { status: string; progress?: number }) => {
      if (data.status === 'progress' && onProgress && data.progress !== undefined) {
        onProgress(Math.round(data.progress));
      }
    }
  });
}

export async function isModelCached(): Promise<boolean> {
  try {
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    return keys.some(req => req.url.includes('mobileclip'));
  } catch {
    return false;
  }
}

export async function getEmbedding(blob: Blob): Promise<Float32Array> {
  if (!modelInstance) {
    throw new Error('Model not loaded');
  }

  // Preprocess using shared library (same as POC/embeddings build)
  const processedImage = await preprocessBlob(blob);

  // Run inference
  const output = await modelInstance(processedImage, INFERENCE_OPTIONS);
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
