import type { PrismaClient } from '@prisma/client';
import { logger } from '../../../shared/logger';
import { assertSafeSqlServerIdentifier } from '../migration-sql-safety';
import { readIsolatedMssqlEnv, runIsolatedSqlcmdQuery } from './migration-bak-sqlcmd';

const ACTIVE_JOB_STATUSES = [
  'DRAFT',
  'ANALYZING',
  'READY_FOR_DRY_RUN',
  'DRY_RUNNING',
  'READY',
  'RUNNING',
  'PAUSED',
  'RECONCILING',
  'BLOCKED',
] as const;

export type BakRestoreMaintenanceResult = {
  expiredRuns: number;
  orphanRuns: number;
  staleCommands: number;
  droppedDatabases: number;
  skippedDropInUse: number;
};

export class MigrationBakRestoreLifecycleService {
  constructor(private readonly prisma: PrismaClient) {}

  async isRestoreConfigInUse(legacySourceConfigId: string | null | undefined): Promise<boolean> {
    if (!legacySourceConfigId) return false;
    const count = await this.prisma.migrationJob.count({
      where: {
        legacySourceConfigId,
        status: { in: [...ACTIVE_JOB_STATUSES] },
      },
    });
    return count > 0;
  }

  /** Mark restore runs past retention; fail stuck queue/restore. */
  async expireAndOrphanRuns(): Promise<{ expiredRuns: number; orphanRuns: number }> {
    const now = new Date();
    const orphanBefore = new Date(
      now.getTime() - Number(process.env.MIGRATION_RESTORE_ORPHAN_AFTER_MS ?? String(6 * 3600_000))
    );

    const expired = await this.prisma.migrationBakRestoreRun.updateMany({
      where: {
        expiresAt: { lt: now },
        status: { in: ['READY', 'RESTORED'] },
      },
      data: { status: 'EXPIRED', completedAt: now },
    });

    const orphans = await this.prisma.migrationBakRestoreRun.updateMany({
      where: {
        status: { in: ['QUEUED', 'RESTORING'] },
        createdAt: { lt: orphanBefore },
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Restore run timed out (orphan detection)',
        completedAt: now,
        progressPercent: 100,
      },
    });

    return { expiredRuns: expired.count, orphanRuns: orphans.count };
  }

  /**
   * Optional DROP of expired restored DBs on isolated host only.
   * Never drops when an active migration job references the config.
   */
  async dropExpiredRestoredDatabases(): Promise<{ dropped: number; skippedInUse: number }> {
    if (process.env.MIGRATION_RESTORE_DROP_EXPIRED_DB !== 'true') {
      return { dropped: 0, skippedInUse: 0 };
    }
    const mssql = readIsolatedMssqlEnv();
    if (!mssql) return { dropped: 0, skippedInUse: 0 };

    const runs = await this.prisma.migrationBakRestoreRun.findMany({
      where: { status: 'EXPIRED', restoredDatabaseName: { not: null } },
      take: 20,
    });

    let dropped = 0;
    let skippedInUse = 0;
    for (const run of runs) {
      if (await this.isRestoreConfigInUse(run.legacySourceConfigId)) {
        skippedInUse += 1;
        continue;
      }
      const dbName = run.restoredDatabaseName!;
      if (!/^GatesLegacyRestore_/i.test(dbName)) {
        logger.warn({ dbName, runId: run.id }, 'Skip drop — database name outside restore prefix');
        continue;
      }
      try {
        const safe = assertSafeSqlServerIdentifier(dbName);
        await runIsolatedSqlcmdQuery(
          mssql,
          `IF DB_ID(N'${safe.replace(/'/g, "''")}') IS NOT NULL DROP DATABASE [${safe}];`,
          120_000
        );
        await this.prisma.migrationBakRestoreRun.update({
          where: { id: run.id },
          data: { status: 'CLEANING_UP', diagnosticsJson: { droppedAt: new Date().toISOString() } },
        });
        dropped += 1;
      } catch (err) {
        logger.error(
          { err, runId: run.id, dbName },
          'Failed to drop expired restored database (non-fatal)'
        );
      }
    }
    return { dropped, skippedInUse };
  }

  async runMaintenance(): Promise<BakRestoreMaintenanceResult> {
    const { expiredRuns, orphanRuns } = await this.expireAndOrphanRuns();
    const { dropped, skippedInUse } = await this.dropExpiredRestoredDatabases();
    const staleCommands = await this.prisma.migrationConnectorCommand.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data: {
        status: 'FAILED',
        errorMessage: 'Command expired',
        completedAt: new Date(),
      },
    });
    if (expiredRuns || orphanRuns || dropped || staleCommands.count) {
      logger.info(
        { expiredRuns, orphanRuns, droppedDatabases: dropped, staleCommands: staleCommands.count },
        'Migration bak-restore maintenance'
      );
    }
    return {
      expiredRuns,
      orphanRuns,
      staleCommands: staleCommands.count,
      droppedDatabases: dropped,
      skippedDropInUse: skippedInUse,
    };
  }
}
