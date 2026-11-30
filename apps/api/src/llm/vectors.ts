/**
 * Scales a vector to length 1. Gemini only normalizes its full-size (3072) embeddings;
 * shorter ones must be normalized by the caller so that distances can be compared.
 */
export function normalize(vector: number[]): number[] {
  const length = Math.hypot(...vector);
  if (!Number.isFinite(length) || length === 0) throw new Error("Cannot normalize an empty or zero vector");
  return vector.map((value) => value / length);
}
