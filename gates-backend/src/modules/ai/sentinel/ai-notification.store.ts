import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import type { PersistedAiNotification, SentinelFinding } from './ai-notification.types';

const DEDUPE_HOURS = 20;

export class AiNotificationStore {
  async upsertFindings(
    companyId: string,
    findings: SentinelFinding[],
    asOf = new Date()
  ): Promise<PersistedAiNotification[]> {
    if (!findings.length) return [];
    const since = new Date(asOf.getTime() - DEDUPE_HOURS * 60 * 60 * 1000);
    const fingerprints = findings.map((row) => row.fingerprint);
    const existing = await prisma.aiNotification.findMany({
      where: {
        companyId,
        fingerprint: { in: fingerprints },
        createdAt: { gte: since },
      },
      select: { fingerprint: true },
    });
    const seen = new Set(existing.map((row) => row.fingerprint).filter(Boolean));
    const created: PersistedAiNotification[] = [];
    for (const finding of findings) {
      if (seen.has(finding.fingerprint)) continue;
      const row = await prisma.aiNotification.create({
        data: {
          companyId,
          targetRoles: [...finding.targetRoles] as Prisma.InputJsonValue,
          category: finding.category,
          severity: finding.severity,
          titleAr: finding.titleAr,
          messageAr: finding.messageAr,
          actionUrl: finding.actionUrl,
          actionLabelAr: finding.actionLabelAr,
          metadata: (finding.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          fingerprint: finding.fingerprint,
        },
      });
      created.push(row);
      seen.add(finding.fingerprint);
    }
    return created;
  }
}

export const aiNotificationStore = new AiNotificationStore();
