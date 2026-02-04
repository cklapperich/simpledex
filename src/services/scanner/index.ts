import { loadModel, getEmbedding, isModelCached } from './model';
import { downloadEmbeddings, getEmbeddings, isEmbeddingsCached, clearEmbeddingsCache } from './embeddings';
import { findSimilar } from './similarity';
import type { ScanMatch } from './types';

export type { ScanMatch } from './types';

export const scannerService = {
  async isReady(): Promise<boolean> {
    const [modelReady, embeddingsReady] = await Promise.all([
      isModelCached(),
      isEmbeddingsCached()
    ]);
    return modelReady && embeddingsReady;
  },

  async download(onProgress: (percent: number) => void): Promise<void> {
    // Model is ~50MB, embeddings ~20MB = 70MB total
    // Weight progress: 70% model, 30% embeddings
    await loadModel((p) => onProgress(Math.round(p * 0.7)));
    await downloadEmbeddings((p) => onProgress(70 + Math.round(p * 0.3)));
  },

  async findMatches(blob: Blob, topK = 5): Promise<ScanMatch[]> {
    // Ensure model is loaded (singleton, returns immediately if already loaded)
    await loadModel();
    const embedding = await getEmbedding(blob);
    const index = await getEmbeddings();
    return findSimilar(embedding, index, topK);
  },

  async clearCache(): Promise<void> {
    await clearEmbeddingsCache();
    // Model cache cleared via browser settings
  }
};
