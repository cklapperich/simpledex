import { pipeline, env } from '@huggingface/transformers';

// Configure for browser
env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = 'Xenova/mobileclip_s2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelInstance: any = null;

export async function loadModel(onProgress?: (percent: number) => void): Promise<void> {
  if (modelInstance) return;

  modelInstance = await pipeline('image-feature-extraction', MODEL_ID, {
    dtype: 'fp32', // Explicit: must match build-embeddings scripts
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
    // Check if any cached entries contain our model ID
    return keys.some(req => req.url.includes('mobileclip'));
  } catch {
    return false;
  }
}

export async function getEmbedding(blob: Blob): Promise<Float32Array> {
  if (!modelInstance) {
    throw new Error('Model not loaded');
  }

  const url = URL.createObjectURL(blob);
  try {
    const output = await modelInstance(url, {
      pooling: 'mean',
      normalize: true
    });
    return new Float32Array(output.data);
  } finally {
    URL.revokeObjectURL(url);
  }
}
