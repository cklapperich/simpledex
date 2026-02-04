import { loadModel, getEmbedding, isModelCached, checkModelForUpdates, markModelChecked, clearModelCache } from './model';
import { downloadEmbeddings, getEmbeddings, isEmbeddingsCached, clearEmbeddingsCache, checkEmbeddingsForUpdates, markEmbeddingsChecked } from './embeddings';
import { findSimilar } from './similarity';
import type { ScanMatch } from './types';

export type { ScanMatch } from './types';

export type AssetStatus = 'fresh' | 'stale' | 'not-downloaded';

export interface SetupStatus {
  model: AssetStatus;
  embeddings: AssetStatus;
}

export const scannerService = {
  async isReady(): Promise<boolean> {
    const [modelReady, embeddingsReady] = await Promise.all([
      isModelCached(),
      isEmbeddingsCached()
    ]);
    return modelReady && embeddingsReady;
  },

  /**
   * Check the status of model and embeddings
   * Returns 'fresh' if up-to-date, 'stale' if update available, 'not-downloaded' if not cached
   */
  async getSetupStatus(): Promise<SetupStatus> {
    const [modelStatus, embeddingsStatus] = await Promise.all([
      checkModelForUpdates(),
      checkEmbeddingsForUpdates()
    ]);
    return {
      model: modelStatus,
      embeddings: embeddingsStatus
    };
  },

  /**
   * Check if download/update is needed
   */
  async needsSetup(): Promise<boolean> {
    const status = await this.getSetupStatus();
    return status.model !== 'fresh' || status.embeddings !== 'fresh';
  },

  async download(onProgress: (percent: number) => void): Promise<void> {
    // Model is ~50MB, embeddings ~20MB = 70MB total
    // Weight progress: 70% model, 30% embeddings
    await loadModel((p) => onProgress(Math.round(p * 0.7)));
    markModelChecked();
    await downloadEmbeddings((p) => onProgress(70 + Math.round(p * 0.3)));
    markEmbeddingsChecked();
  },

  async findMatches(blob: Blob, topK = 5): Promise<ScanMatch[]> {
    // Ensure model is loaded (singleton, returns immediately if already loaded)
    await loadModel();
    const embedding = await getEmbedding(blob);
    const index = await getEmbeddings();
    return findSimilar(embedding, index, topK);
  },

  async clearCache(): Promise<void> {
    await Promise.all([
      clearEmbeddingsCache(),
      clearModelCache()
    ]);
  }
};
