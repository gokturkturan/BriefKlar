/**
 * Scales a vector to length 1, so that distances between vectors can be compared whatever the
 * embedding model returns (shortened embeddings are not always normalized).
 */
export function normalize(vector: number[]): number[] {
  const length = Math.hypot(...vector);
  if (!Number.isFinite(length) || length === 0) throw new Error("Cannot normalize an empty or zero vector");
  return vector.map((value) => value / length);
}
