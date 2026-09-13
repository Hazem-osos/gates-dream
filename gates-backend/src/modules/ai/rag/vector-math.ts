export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0;
  return dot / denom;
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.map((n) => (Number.isFinite(n) ? n.toFixed(8) : '0')).join(',')}]`;
}

export function asEmbedding(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const nums = value.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  return nums.length === 1536 ? nums : null;
}
