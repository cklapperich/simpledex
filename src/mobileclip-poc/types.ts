/**
 * Represents a card's embedding data
 */
export interface CardEmbedding {
  cardId: string;
  embedding: number[];
  imagePath: string;
}

/**
 * Database structure for storing embeddings
 */
export interface EmbeddingDatabase {
  version: string;
  modelId: string;
  createdAt: string;
  embeddings: CardEmbedding[];
}

/**
 * Result from similarity search
 */
export interface SimilarityResult {
  cardId: string;
  score: number;
  imagePath: string;
}

/**
 * CLI options for the build command
 */
export interface BuildOptions {
  imageDir: string;
  output: string;
}

/**
 * CLI options for the search command
 */
export interface SearchOptions {
  imagePath: string;
  embeddingsPath: string;
  topK: number;
}
