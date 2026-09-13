import type { InsightCategory, InsightSeverity } from '@prisma/client';

export type DetectorFinding = {
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  fallbackSummary: string;
  deterministicData: Record<string, unknown>;
  actionLink?: string;
  fingerprint: string;
};

export type DetectorContext = {
  companyId: string;
  asOf: Date;
};

export type AnomalyDetector = {
  readonly name: string;
  detect(ctx: DetectorContext): Promise<DetectorFinding[]>;
};

export function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function addDays(from: Date, days: number): Date {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
