import type { EmbeddingIndex, ScanMatch } from './types';

export function findSimilar(
  query: Float32Array,
  index: EmbeddingIndex,
  topK: number = 5
): ScanMatch[] {
  const scores: ScanMatch[] = [];
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
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}
