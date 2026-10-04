import type { Prisma, PrismaClient } from '@prisma/client';
import { assertTransition, type MigrationJobStatus } from '../state-machine';
import type { ReconciliationBaseline } from '../types';

export class MigrationJobService {
  constructor(private readonly prisma: PrismaClient) {}

  async createJob(params: {
    targetCompanyId: string;
    legacyCompanyCode: string;
    sourceType: string;
    sourceFingerprint: string;
    sourceDatabaseName?: string;
    legacyConnectionRef?: string;
    reconciliationBaseline?: ReconciliationBaseline;
  }) {
    return this.prisma.migrationJob.create({
      data: {
        targetCompanyId: params.targetCompanyId,
        legacyCompanyCode: params.legacyCompanyCode,
        sourceType: params.sourceType,
        sourceFingerprint: params.sourceFingerprint,
        sourceDatabaseName: params.sourceDatabaseName,
        legacyConnectionRef: params.legacyConnectionRef ?? 'LEGACY_FORENSIC_URL',
        status: 'DRAFT',
        reconciliationBaseline: (params.reconciliationBaseline ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async getJob(id: string) {
    return this.prisma.migrationJob.findUnique({ where: { id } });
  }

  async transition(id: string, to: MigrationJobStatus, extra?: Partial<{ dryRun: boolean; currentStage: string }>) {
    const job = await this.getJob(id);
    if (!job) throw new Error(`Migration job not found: ${id}`);
    assertTransition(job.status as MigrationJobStatus, to);
    return this.prisma.migrationJob.update({
      where: { id },
      data: {
        status: to,
        dryRun: extra?.dryRun ?? job.dryRun,
        currentStage: extra?.currentStage ?? job.currentStage,
        startedAt: to === 'RUNNING' || to === 'DRY_RUNNING' ? new Date() : job.startedAt,
        completedAt: to === 'COMPLETED' ? new Date() : job.completedAt,
        failedAt: to === 'FAILED' ? new Date() : job.failedAt,
      },
    });
  }

  async countOpenBlockers(jobId: string) {
    return this.prisma.migrationIssue.count({
      where: { migrationJobId: jobId, severity: 'BLOCKER', resolutionState: 'OPEN' },
    });
  }

  async acquireLock(jobId: string, token: string, ttlMs = 5 * 60_000) {
    const now = new Date();
    const expires = new Date(now.getTime() + ttlMs);
    const updated = await this.prisma.migrationJob.updateMany({
      where: {
        id: jobId,
        OR: [{ lockToken: null }, { lockExpiresAt: { lt: now } }],
      },
      data: { lockToken: token, lockExpiresAt: expires },
    });
    return updated.count === 1;
  }

  async releaseLock(jobId: string, token: string) {
    await this.prisma.migrationJob.updateMany({
      where: { id: jobId, lockToken: token },
      data: { lockToken: null, lockExpiresAt: null },
    });
  }

  async assertFingerprint(jobId: string, fingerprint: string) {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Migration job not found: ${jobId}`);
    if (job.sourceFingerprint !== fingerprint) {
      throw new Error(
        `Source fingerprint mismatch for job ${jobId}. Expected ${job.sourceFingerprint}, got ${fingerprint}.`
      );
    }
  }
}
