import { pipeline, env } from '@huggingface/transformers';
import { DTYPE, INFERENCE_OPTIONS } from '../../config/model-config';
import { preprocessBlob, normalizeEmbedding } from '../../lib/preprocessing';
import { openDB, type IDBPDatabase } from 'idb';

// Configure for browser - use local model files
env.allowLocalModels = true;
env.useBrowserCache = true;

// Local model URL path (served from public/model/)
const LOCAL_MODEL_URL = '/model/';
const MODEL_CONFIG_URL = '/model/config.json';

// IndexedDB for storing model ETag
const DB_NAME = 'simpledex-scanner';
const STORE_NAME = 'model-meta';
const ETAG_KEY = 'model-etag';

// Session storage key to track if we've checked for updates this session
const SESSION_CHECK_KEY = 'simpledex-model-checked';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelInstance: any = null;
let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('embeddings');
      }
      if (oldVersion < 2) {
        db.createObjectStore(STORE_NAME);
      }
    }
  });
  return dbInstance;
}

export async function loadModel(onProgress?: (percent: number) => void): Promise<void> {
  if (modelInstance) return;

  modelInstance = await pipeline('image-feature-extraction', LOCAL_MODEL_URL, {
    dtype: DTYPE,
    progress_callback: (data: { status: string; progress?: number }) => {
      if (data.status === 'progress' && onProgress && data.progress !== undefined) {
        onProgress(Math.round(data.progress));
      }
    }
  });

  // Store ETag after successful download
  await storeModelETag();
}

export async function isModelCached(): Promise<boolean> {
  try {
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    return keys.some(req => req.url.includes('/model/'));
  } catch {
    return false;
  }
}

/**
 * Fetch and store the current ETag for the model config file
 */
async function storeModelETag(): Promise<void> {
  try {
    const response = await fetch(MODEL_CONFIG_URL, { method: 'HEAD' });
    const etag = response.headers.get('ETag');
    if (etag) {
      const db = await getDB();
      await db.put(STORE_NAME, etag, ETAG_KEY);
    }
  } catch {
    // Ignore errors - ETag storage is best effort
  }
}

/**
 * Get the stored ETag for the model
 */
async function getStoredModelETag(): Promise<string | null> {
  try {
    const db = await getDB();
    const etag = await db.get(STORE_NAME, ETAG_KEY);
    return etag ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if the model has been updated on the server
 * Returns 'fresh' if unchanged, 'stale' if updated, 'not-downloaded' if not cached
 */
export async function checkModelForUpdates(): Promise<'fresh' | 'stale' | 'not-downloaded'> {
  // Check if we've already verified this session
  if (sessionStorage.getItem(SESSION_CHECK_KEY) === 'checked') {
    return 'fresh';
  }

  const cached = await isModelCached();
  if (!cached) {
    return 'not-downloaded';
  }

  const storedETag = await getStoredModelETag();
  if (!storedETag) {
    // No ETag stored - assume stale to force re-download with proper ETag tracking
    return 'stale';
  }

  try {
    const response = await fetch(MODEL_CONFIG_URL, {
      method: 'HEAD',
      headers: {
        'If-None-Match': storedETag
      }
    });

    if (response.status === 304) {
      // Not modified - mark as checked for this session
      sessionStorage.setItem(SESSION_CHECK_KEY, 'checked');
      return 'fresh';
    }

    // Model has been updated
    return 'stale';
  } catch {
    // Network error - assume fresh to allow offline usage
    sessionStorage.setItem(SESSION_CHECK_KEY, 'checked');
    return 'fresh';
  }
}

/**
 * Mark the model as checked for this session (called after successful download)
 */
export function markModelChecked(): void {
  sessionStorage.setItem(SESSION_CHECK_KEY, 'checked');
}

/**
 * Clear the model cache (forces re-download on next load)
 */
export async function clearModelCache(): Promise<void> {
  try {
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    for (const key of keys) {
      if (key.url.includes('/model/')) {
        await cache.delete(key);
      }
    }
    // Clear stored ETag
    const db = await getDB();
    await db.delete(STORE_NAME, ETAG_KEY);
    // Clear session check
    sessionStorage.removeItem(SESSION_CHECK_KEY);
  } catch {
    // Ignore errors
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

  // L2 normalize using shared function
  return normalizeEmbedding(embedding);
}
