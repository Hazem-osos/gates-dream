import type { InsightCategory, InsightSeverity, Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import type { DetectorFinding } from './detector.types';

const ACTIVE_WINDOW_DAYS = 7;

export type ActiveInsight = {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  summary: string;
  deterministicData: unknown;
  actionLink: string | null;
  createdAt: Date;
  expiresAt: Date | null;
};

function fingerprintOf(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const value = (data as Record<string, unknown>)._fingerprint;
  return typeof value === 'string' ? value : undefined;
}

export class InsightStore {
  async listActive(companyId: string): Promise<ActiveInsight[]> {
    const now = new Date();
    return prisma.aiInsight.findMany({
      where: {
        companyId,
        isDismissed: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });
  }

  async dismiss(insightId: string, companyId: string): Promise<ActiveInsight> {
    const existing = await prisma.aiInsight.findFirst({
      where: { id: insightId, companyId },
    });
    if (!existing) {
      throw Object.assign(new Error('Insight not found'), { statusCode: 404 });
    }
    return prisma.aiInsight.update({
      where: { id: existing.id },
      data: { isDismissed: true },
    });
  }

  async expireStale(companyId: string, asOf = new Date()): Promise<number> {
    const cutoff = new Date(asOf);
    cutoff.setUTCDate(cutoff.getUTCDate() - ACTIVE_WINDOW_DAYS);
    const result = await prisma.aiInsight.updateMany({
      where: {
        companyId,
        isDismissed: false,
        OR: [{ expiresAt: { lte: asOf } }, { createdAt: { lt: cutoff } }],
      },
      data: { isDismissed: true },
    });
    return result.count;
  }

  async persistFindings(
    companyId: string,
    findings: Array<DetectorFinding & { summary: string }>,
    asOf = new Date()
  ): Promise<ActiveInsight[]> {
    const expiresAt = new Date(asOf);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + ACTIVE_WINDOW_DAYS);
    const existing = await prisma.aiInsight.findMany({
      where: { companyId, isDismissed: false },
    });

    const saved: ActiveInsight[] = [];
    for (const finding of findings) {
      const data = {
        ...finding.deterministicData,
        _fingerprint: finding.fingerprint,
      } as Prisma.InputJsonValue;
      const match = existing.find(
        (row) => row.category === finding.category && fingerprintOf(row.deterministicData) === finding.fingerprint
      );
      if (match) {
        saved.push(
          await prisma.aiInsight.update({
            where: { id: match.id },
            data: {
              severity: finding.severity,
              title: finding.title,
              summary: finding.summary,
              deterministicData: data,
              actionLink: finding.actionLink ?? null,
              expiresAt,
            },
          })
        );
        continue;
      }
      saved.push(
        await prisma.aiInsight.create({
          data: {
            companyId,
            category: finding.category,
            severity: finding.severity,
            title: finding.title,
            summary: finding.summary,
            deterministicData: data,
            actionLink: finding.actionLink ?? null,
            expiresAt,
          },
        })
      );
    }
    return saved;
  }
}

export const insightStore = new InsightStore();
