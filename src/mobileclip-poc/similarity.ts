import type { CardEmbedding, SimilarityResult } from './types.js';

/**
 * Calculate cosine similarity between two vectors
 * Formula: (A · B) / (||A|| × ||B||)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Find the most similar cards to a query embedding
 * @param queryEmbedding - The embedding vector to search with
 * @param embeddings - Array of card embeddings to search through
 * @param topK - Number of results to return
 * @returns Top-K most similar cards sorted by score (descending)
 */
export function findSimilar(
  queryEmbedding: number[],
  embeddings: CardEmbedding[],
  topK: number = 5
): SimilarityResult[] {
  const results: SimilarityResult[] = embeddings.map((card) => ({
    cardId: card.cardId,
    score: cosineSimilarity(queryEmbedding, card.embedding),
    imagePath: card.imagePath,
  }));

  // Sort by score descending and take top K
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topK);
}
