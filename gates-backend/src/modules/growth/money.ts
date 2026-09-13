export function asMoney(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function monthsAgo(asOf: Date, months: number): Date {
  const d = new Date(asOf);
  d.setMonth(d.getMonth() - months);
  return d;
}

export function priorityFromAmount(amount: number, critical: number, high: number, medium: number) {
  if (amount >= critical) return 'CRITICAL' as const;
  if (amount >= high) return 'HIGH' as const;
  if (amount >= medium) return 'MEDIUM' as const;
  return 'LOW' as const;
}
