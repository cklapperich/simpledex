export interface ScanMatch {
  cardId: string;
  score: number;
}

export interface EmbeddingIndex {
  cardIds: string[];
  embeddings: Float32Array;
}
