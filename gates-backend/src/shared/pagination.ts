/** Caps list sizes so an omitted or huge take/limit cannot scan a whole table. */
export function clampPageSize(value: unknown, fallback = 50, max = 200): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}
