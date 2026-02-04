# Plan 2: WebGL/Inferencing Service

## Overview
Browser-based MobileClip inference service. Downloads model + embeddings on demand, generates embeddings from camera blobs, returns N closest card matches via similarity search.

---

## Files to Create

### `src/services/scanner/index.ts`
Main service interface (replaces stub from Plan 1):
```typescript
export const scannerService = {
  // Check if model + embeddings are cached and ready
  isReady(): Promise<boolean>;

  // Download model + embeddings with progress callback
  download(onProgress: (percent: number) => void): Promise<void>;

  // Find matching cards for a captured image
  findMatches(blob: Blob, topK?: number): Promise<ScanMatch[]>;

  // Clear cached data
  clearCache(): Promise<void>;
};

interface ScanMatch {
  cardId: string;
  score: number;  // 0-1 confidence
}
```

### `src/services/scanner/model.ts`
Browser-adapted MobileClip (based on `src/mobileclip-poc/model.ts`):
```typescript
import { pipeline, env } from '@huggingface/transformers';

// Configure for browser
env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = 'Xenova/mobileclip_s2';
let modelInstance: any = null;

// Load model with progress callback
export async function loadModel(
  onProgress?: (percent: number) => void
): Promise<void>;

// Check if model is cached
export async function isModelCached(): Promise<boolean>;

// Generate embedding from blob
export async function getEmbedding(blob: Blob): Promise<Float32Array>;
```

**Key adaptation from POC:**
- Accept Blob → create Object URL → pass to pipeline
- Add progress callback for download UI
- Check transformers.js cache for isModelCached

### `src/services/scanner/embeddings.ts`
Binary embeddings loader with IndexedDB cache:
```typescript
const DB_NAME = 'simpledex-scanner';
const STORE_NAME = 'embeddings';
const EMBEDDINGS_URL = '/embeddings.bin';  // or Supabase URL

// Check if embeddings are cached in IndexedDB
export async function isEmbeddingsCached(): Promise<boolean>;

// Download and cache embeddings
export async function downloadEmbeddings(
  onProgress?: (percent: number) => void
): Promise<void>;

// Load embeddings from cache
export async function getEmbeddings(): Promise<EmbeddingIndex>;

// Clear cache
export async function clearEmbeddingsCache(): Promise<void>;

interface EmbeddingIndex {
  cardIds: string[];           // Card IDs in order
  embeddings: Float32Array;    // Flat array: cardIds.length * 512
}
```

**Binary format:**
- Header: 4 bytes (uint32 card count)
- For each card:
  - 4 bytes (uint32 cardId length)
  - N bytes (cardId string, UTF-8)
  - 2048 bytes (512 × float32 embedding)

### `src/services/scanner/similarity.ts`
Cosine similarity search (port from `src/mobileclip-poc/similarity.ts`):
```typescript
// Find top K similar cards
export function findSimilar(
  query: Float32Array,
  index: EmbeddingIndex,
  topK: number = 5
): ScanMatch[];

// Cosine similarity between two vectors
function cosineSimilarity(a: Float32Array, b: Float32Array): number;
```

### `src/services/scanner/types.ts`
```typescript
export interface ScanMatch {
  cardId: string;
  score: number;
}

export interface EmbeddingIndex {
  cardIds: string[];
  embeddings: Float32Array;
}
```

---

## Implementation Details

### Model Loading with Progress
```typescript
export async function loadModel(onProgress?: (percent: number) => void): Promise<void> {
  if (modelInstance) return;

  modelInstance = await pipeline('image-feature-extraction', MODEL_ID, {
    progress_callback: (data: any) => {
      if (data.status === 'progress' && onProgress) {
        onProgress(Math.round(data.progress));
      }
    }
  });
}
```

### Embedding from Blob
```typescript
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
```

### Combined Download with Progress
```typescript
// In index.ts
export async function download(onProgress: (percent: number) => void): Promise<void> {
  // Model is ~50MB, embeddings ~20MB = 70MB total
  // Weight progress: 70% model, 30% embeddings

  await loadModel((p) => onProgress(Math.round(p * 0.7)));
  await downloadEmbeddings((p) => onProgress(70 + Math.round(p * 0.3)));
}
```

### Similarity Search
```typescript
export function findSimilar(
  query: Float32Array,
  index: EmbeddingIndex,
  topK: number = 5
): ScanMatch[] {
  const scores: Array<{ cardId: string; score: number }> = [];
  const dim = 512;

  for (let i = 0; i < index.cardIds.length; i++) {
    const offset = i * dim;
    const embedding = index.embeddings.subarray(offset, offset + dim);
    const score = cosineSimilarity(query, embedding);
    scores.push({ cardId: index.cardIds[i], score });
  }

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot; // Vectors are already normalized
}
```

---

## Caching Strategy

### Model Cache
- transformers.js automatically caches to Cache Storage
- Check with: `caches.has('transformers-cache')` or try loading

### Embeddings Cache (IndexedDB)
```typescript
import { openDB } from 'idb';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    }
  });
}

export async function isEmbeddingsCached(): Promise<boolean> {
  const db = await getDB();
  const data = await db.get(STORE_NAME, 'index');
  return data !== undefined;
}

export async function downloadEmbeddings(onProgress?: (p: number) => void): Promise<void> {
  const response = await fetch(EMBEDDINGS_URL);
  const reader = response.body!.getReader();
  const contentLength = +response.headers.get('Content-Length')!;

  let received = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(Math.round((received / contentLength) * 100));
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  const index = parseEmbeddingsBinary(buffer);

  const db = await getDB();
  await db.put(STORE_NAME, index, 'index');
}
```

---

## Dependencies

- `@huggingface/transformers` (already in package.json)
- `idb` (add to package.json for IndexedDB wrapper)

---

## Integration with Plan 1

Replace stub in `src/services/scanner/index.ts`:
```typescript
import { loadModel, getEmbedding, isModelCached } from './model';
import { downloadEmbeddings, getEmbeddings, isEmbeddingsCached } from './embeddings';
import { findSimilar } from './similarity';

export const scannerService = {
  async isReady(): Promise<boolean> {
    const [modelReady, embeddingsReady] = await Promise.all([
      isModelCached(),
      isEmbeddingsCached()
    ]);
    return modelReady && embeddingsReady;
  },

  async download(onProgress: (percent: number) => void): Promise<void> {
    await loadModel((p) => onProgress(Math.round(p * 0.7)));
    await downloadEmbeddings((p) => onProgress(70 + Math.round(p * 0.3)));
  },

  async findMatches(blob: Blob, topK = 5): Promise<ScanMatch[]> {
    const embedding = await getEmbedding(blob);
    const index = await getEmbeddings();
    return findSimilar(embedding, index, topK);
  },

  async clearCache(): Promise<void> {
    await clearEmbeddingsCache();
    // Model cache cleared via browser settings
  }
};
```

---

## Verification

1. `scannerService.isReady()` returns false initially
2. `scannerService.download()` shows progress 0-100
3. `scannerService.isReady()` returns true after download
4. `scannerService.findMatches(blob)` returns top 5 matches
5. Refresh page → isReady() still true (cached)
6. `scannerService.clearCache()` → isReady() false
