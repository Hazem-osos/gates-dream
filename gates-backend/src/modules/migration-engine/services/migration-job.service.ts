import type { Prisma, PrismaClient } from '@prisma/client';
import { assertTransition, type MigrationJobStatus } from '../state-machine';
import type { ReconciliationBaseline } from '../types';
import { isProvisionalPackageFingerprint } from '../types';

export class MigrationJobService {
  constructor(private readonly prisma: PrismaClient) {}

  async createJob(params: {
    targetCompanyId: string;
    legacyCompanyCode: string;
    sourceType: string;
    sourceMode?: string;
    sourceFingerprint: string;
    sourceDatabaseName?: string;
    legacyConnectionRef?: string;
    legacySourceConfigId?: string;
    reconciliationBaseline?: ReconciliationBaseline;
  }) {
    return this.prisma.migrationJob.create({
      data: {
        targetCompanyId: params.targetCompanyId,
        legacyCompanyCode: params.legacyCompanyCode,
        sourceType: params.sourceType,
        sourceMode: params.sourceMode ?? null,
        sourceFingerprint: params.sourceFingerprint,
        sourceDatabaseName: params.sourceDatabaseName,
        legacyConnectionRef: params.legacyConnectionRef ?? null,
        legacySourceConfigId: params.legacySourceConfigId ?? null,
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

  /**
   * Stage lock under an already-running coordinator: reuse the held lock
   * instead of failing with «locked by another runner».
   */
  async acquireLockOrReuse(
    jobId: string,
    token: string,
    ttlMs = 5 * 60_000
  ): Promise<'acquired' | 'reused'> {
    if (await this.acquireLock(jobId, token, ttlMs)) return 'acquired';
    const row = await this.prisma.migrationJob.findUnique({
      where: { id: jobId },
      select: { lockToken: true, lockExpiresAt: true },
    });
    const now = new Date();
    if (row?.lockToken && row.lockExpiresAt && row.lockExpiresAt > now) {
      return 'reused';
    }
    throw new Error(`Job ${jobId} is locked by another runner.`);
  }

  async releaseLock(jobId: string, token: string) {
    await this.prisma.migrationJob.updateMany({
      where: { id: jobId, lockToken: token },
      data: { lockToken: null, lockExpiresAt: null },
    });
  }

  /** Clear the runner lock even if the worker token is unknown (user abort). */
  async forceReleaseLock(jobId: string) {
    await this.prisma.migrationJob.updateMany({
      where: { id: jobId },
      data: { lockToken: null, lockExpiresAt: null },
    });
  }

  async extendLock(jobId: string, token: string, ttlMs = 5 * 60_000) {
    const now = new Date();
    const expires = new Date(now.getTime() + ttlMs);
    const updated = await this.prisma.migrationJob.updateMany({
      where: { id: jobId, lockToken: token },
      data: { lockExpiresAt: expires },
    });
    return updated.count === 1;
  }

  assertJobBelongsToCompany(
    job: { targetCompanyId: string } | null,
    companyId: string,
    jobId?: string
  ): void {
    if (!job || job.targetCompanyId !== companyId) {
      throw new Error(jobId ? `Migration job not found: ${jobId}` : 'Migration job not found');
    }
  }

  async requestCancellation(jobId: string) {
    await this.mergeProgress(jobId, {
      cancelRequestedAt: new Date().toISOString(),
    });
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Migration job not found: ${jobId}`);
    if (job.status === 'RUNNING' || job.status === 'DRY_RUNNING' || job.status === 'ANALYZING') {
      return job;
    }
    if (job.status === 'PAUSED') {
      return this.transition(jobId, 'FAILED');
    }
    return job;
  }

  async isCancelRequested(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job?.progress || typeof job.progress !== 'object' || Array.isArray(job.progress)) return false;
    return Boolean((job.progress as Record<string, unknown>).cancelRequestedAt);
  }

  async assertFingerprint(jobId: string, fingerprint: string) {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Migration job not found: ${jobId}`);
    if (isProvisionalPackageFingerprint(job.sourceFingerprint)) {
      await this.commitSourceFingerprint(jobId, fingerprint);
      return;
    }
    if (job.sourceFingerprint !== fingerprint) {
      throw new Error(
        `Source fingerprint mismatch for job ${jobId}. Expected ${job.sourceFingerprint}, got ${fingerprint}.`
      );
    }
  }

  async commitSourceFingerprint(jobId: string, fingerprint: string, sourceDatabaseName?: string) {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Migration job not found: ${jobId}`);
    if (!isProvisionalPackageFingerprint(job.sourceFingerprint)) {
      if (job.sourceFingerprint !== fingerprint) {
        throw new Error('Refusing to change committed source fingerprint');
      }
      return job;
    }
    return this.prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        sourceFingerprint: fingerprint,
        sourceDatabaseName: sourceDatabaseName ?? job.sourceDatabaseName,
      },
    });
  }

  async listForCompany(targetCompanyId: string, limit = 20) {
    return this.prisma.migrationJob.findMany({
      where: { targetCompanyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findActiveForCompany(targetCompanyId: string) {
    return this.prisma.migrationJob.findFirst({
      where: {
        targetCompanyId,
        status: { in: ['ANALYZING', 'DRY_RUNNING', 'RUNNING', 'RECONCILING', 'PAUSED'] },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateProgress(id: string, progress: Prisma.InputJsonValue) {
    return this.prisma.migrationJob.update({
      where: { id },
      data: { progress },
    });
  }

  async mergeProgress(id: string, patch: Record<string, unknown>) {
    const job = await this.getJob(id);
    if (!job) throw new Error(`Migration job not found: ${id}`);
    const current =
      job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
        ? (job.progress as Record<string, unknown>)
        : {};
    const next: Record<string, unknown> = { ...current, ...patch };
    if (patch.ui && typeof patch.ui === 'object' && !Array.isArray(patch.ui)) {
      const curUi =
        current.ui && typeof current.ui === 'object' && !Array.isArray(current.ui)
          ? (current.ui as Record<string, unknown>)
          : {};
      next.ui = { ...curUi, ...(patch.ui as Record<string, unknown>) };
    }
    return this.updateProgress(id, next as Prisma.InputJsonValue);
  }
}
