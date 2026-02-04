import config from './model-config.json';

export const MODEL_CONFIG = config;

export type ModelConfig = typeof MODEL_CONFIG;

// Valid dtype values for transformers.js
type DType = 'fp32' | 'fp16' | 'q8' | 'int8' | 'uint8' | 'q4' | 'bnb4' | 'q4f16' | 'auto';

// Convenience exports for common values
export const MODEL_ID = MODEL_CONFIG.modelId;
export const EMBEDDING_DIM = MODEL_CONFIG.embeddingDim;
export const DTYPE = MODEL_CONFIG.dtype as DType;
export const INFERENCE_OPTIONS = MODEL_CONFIG.inference as {
  pooling: 'mean' | 'cls' | 'none';
  normalize: boolean;
};
