import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import { getPackage } from './migration-package.storage';
import { assessBakRestore } from './migration-bak-restore.service';
import { LegacySourceConfigService } from '../legacy-source/legacy-source-config.service';
import { enqueueMigrationBakRestore } from '../../../workers/queues/migration-bak-restore.queue';

export type BakRestoreLifecycleStatus =
  | 'UPLOADED'
  | 'VALIDATING'
  | 'QUEUED'
  | 'RESTORING'
  | 'RESTORED'
  | 'READY'
  | 'FAILED'
  | 'CLEANING_UP'
  | 'EXPIRED';

export class MigrationBakRestoreOrchestrationService {
  constructor(private readonly prisma: PrismaClient) {}

  async startRestore(companyId: string, packageId: string, migrationJobId?: string) {
    const pkg = await getPackage(companyId, packageId);
    if (!pkg) throw new AppError(404, 'Package not found');

    const assessment = await assessBakRestore(pkg);
    if (assessment.status === 'NOT_APPLICABLE') {
      throw new AppError(400, assessment.message);
    }
    if (assessment.status !== 'READY_TO_RUN' && assessment.status !== 'BLOCKED') {
      throw new AppError(400, assessment.message);
    }
    if (assessment.status === 'BLOCKED') {
      throw new AppError(503, assessment.message);
    }

    const existing = await this.prisma.migrationBakRestoreRun.findFirst({
      where: { companyId, status: { in: ['QUEUED', 'RESTORING', 'READY'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      if (existing.packageId === packageId) return existing;
      throw new AppError(
        409,
        'استعادة أخرى ما زالت قائمة لهذه الشركة. لا تُستبدل قاعدة SQL ولا إعداد المصدر قبل انتهائها.'
      );
    }

    const ttlDays = Number(process.env.MIGRATION_RESTORE_RETENTION_DAYS ?? '7');
    const run = await this.prisma.migrationBakRestoreRun.create({
      data: {
        id: randomUUID(),
        companyId,
        packageId,
        migrationJobId: migrationJobId ?? null,
        status: 'QUEUED',
        progressPercent: 0,
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });

    const queued = await enqueueMigrationBakRestore({ restoreRunId: run.id, companyId, packageId });
    if (!queued) {
      await this.prisma.migrationBakRestoreRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Redis is not available — restore job was not queued. Enable REDIS and the bak-restore worker.',
          completedAt: new Date(),
        },
      });
      throw new AppError(503, 'تعذّر جدولة الاستعادة — Redis أو عامل الاستعادة غير متاح');
    }

    return run;
  }

  async getRun(companyId: string, restoreRunId: string) {
    const run = await this.prisma.migrationBakRestoreRun.findFirst({
      where: { id: restoreRunId, companyId },
    });
    if (!run) throw new AppError(404, 'Restore run not found');
    return run;
  }

  async markReadyFromWorker(params: {
    restoreRunId: string;
    companyId: string;
    restoredDatabaseName: string;
    remote: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      encrypt: boolean;
      trustServerCertificate: boolean;
    };
    fingerprint: string;
  }) {
    const configSvc = new LegacySourceConfigService(this.prisma);
    const config = await configSvc.bindBackupRestoreSource(
      params.companyId,
      params.restoreRunId,
      (await this.getRun(params.companyId, params.restoreRunId)).packageId,
      { kind: 'REMOTE_SQL_SERVER', ...params.remote },
      params.fingerprint,
      params.restoredDatabaseName
    );

    return this.prisma.migrationBakRestoreRun.update({
      where: { id: params.restoreRunId },
      data: {
        status: 'READY',
        progressPercent: 100,
        restoredDatabaseName: params.restoredDatabaseName,
        legacySourceConfigId: config.id,
        completedAt: new Date(),
      },
    });
  }
}
