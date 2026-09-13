import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import type { SentinelExecutiveReport } from './sentinel.types';

export type CachedSentinelSnapshot = {
  payload: SentinelExecutiveReport;
  generatedAt: Date;
};

function isReport(value: unknown): value is SentinelExecutiveReport {
  if (!value || typeof value !== 'object') return false;
  const row = value as SentinelExecutiveReport;
  return (
    typeof row.narrative === 'string' &&
    typeof row.generatedAt === 'string' &&
    row.fraud != null &&
    Array.isArray(row.replacement) &&
    row.cashflow != null
  );
}

export class SentinelSnapshotStore {
  async get(companyId: string): Promise<CachedSentinelSnapshot | null> {
    const row = await prisma.aiSentinelSnapshot.findUnique({
      where: { companyId },
      select: { payload: true, generatedAt: true },
    });
    if (!row || !isReport(row.payload)) return null;
    return { payload: row.payload, generatedAt: row.generatedAt };
  }

  async upsert(companyId: string, report: SentinelExecutiveReport): Promise<void> {
    const generatedAt = new Date(report.generatedAt);
    const data = {
      payload: report as unknown as Prisma.InputJsonValue,
      generatedAt: Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt,
      source: report.source,
    };
    await prisma.aiSentinelSnapshot.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
  }
}

export const sentinelSnapshotStore = new SentinelSnapshotStore();
