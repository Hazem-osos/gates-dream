import fs from 'node:fs/promises';
import path from 'node:path';
import type { StoredMigrationPackage } from './migration-package.storage';
import {
  assertBackupPathUnderRoot,
  assertSafeSqlServerIdentifier,
  isolatedMssqlHostRejection,
} from '../migration-sql-safety';
import {
  buildRestoreDatabaseSql,
  buildRestoreMoveClauses,
  buildDatabaseStateQuery,
  buildDropDatabaseSql,
  parseDatabaseState,
  inspectBackupOnIsolatedHost,
} from './migration-bak-metadata.service';
import { readIsolatedMssqlEnv, runIsolatedSqlcmdQuery } from './migration-bak-sqlcmd';
import { commandExists, dockerAvailable } from './migration-bak-restore-env';
import {
  cleanupStagedBackup,
  stageBackupForRestore,
  type StagedBackup,
} from './migration-bak-staging.service';
import { expressRestoreVerdict, restoreStorageBudget } from '../migration-engine-config';
import { deleteBackupObject } from './migration-bak-transport';

export type BakRestoreStatus =
  | 'NOT_APPLICABLE'
  | 'BLOCKED'
  | 'READY_TO_RUN'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED';

export type BakRestoreAssessment = {
  status: BakRestoreStatus;
  message: string;
  requirements: string[];
  packageId?: string;
  estimatedDbName?: string;
};

export type BakRestoreRunResult = BakRestoreAssessment & {
  stagedPath?: string;
  legacyLogicalDataName?: string;
};

function isBakPackage(pkg: StoredMigrationPackage): boolean {
  return path.extname(pkg.originalName).toLowerCase() === '.bak';
}

/**
 * Safe restore is never attempted against production hosts.
 * Requires explicit MIGRATION_BAK_RESTORE_ENABLED=true and isolated SQL Server config.
 */
export async function assessBakRestore(pkg: StoredMigrationPackage): Promise<BakRestoreAssessment> {
  if (!isBakPackage(pkg)) {
    return {
      status: 'NOT_APPLICABLE',
      message: 'Only SQL Server .bak files can be restored. Zip/7z archives are storage-only until validated.',
      requirements: [],
      packageId: pkg.id,
    };
  }

  const requirements: string[] = [
    'Docker OR native SQL Server 2019+ with sqlcmd on restore worker',
    'MIGRATION_BAK_RESTORE_ENABLED=true',
    'MIGRATION_ISOLATED_MSSQL_HOST (not production)',
    'MIGRATION_ISOLATED_BACKUP_DIR or MIGRATION_RESTORE_PACKAGE_FETCH_URL for file transfer',
    'Free disk >= backup size × 2',
  ];

  if (process.env.MIGRATION_BAK_RESTORE_ENABLED !== 'true') {
    return {
      status: 'BLOCKED',
      message: 'Automated .bak restore is disabled. Set MIGRATION_BAK_RESTORE_ENABLED=true on an isolated migration host.',
      requirements,
      packageId: pkg.id,
    };
  }

  const host = process.env.MIGRATION_ISOLATED_MSSQL_HOST?.trim();
  const hostRejection = isolatedMssqlHostRejection(host);
  if (hostRejection) {
    return {
      status: 'BLOCKED',
      message:
        `${hostRejection} ` +
        'The restore process must run inside the SQL Server container so RESTORE FROM DISK sees the file.',
      requirements,
      packageId: pkg.id,
    };
  }

  if (process.env.MIGRATION_SQL_SEES_BACKUP_DIR !== 'true') {
    return {
      status: 'BLOCKED',
      message:
        'RESTORE FROM DISK reads a path on the SQL Server machine, not on the API. ' +
        'Railway volumes attach to one service, so a separate worker cannot see the API disk and SQL cannot see the worker disk. ' +
        'Run the restore worker in the SQL container and set MIGRATION_SQL_SEES_BACKUP_DIR=true.',
      requirements,
      packageId: pkg.id,
    };
  }

  const hasSqlcmd = await commandExists('sqlcmd');
  const hasDocker = await dockerAvailable();
  if (!hasSqlcmd && !hasDocker) {
    return {
      status: 'BLOCKED',
      message: 'Neither docker nor sqlcmd is available on this runtime — cannot restore .bak safely.',
      requirements,
      packageId: pkg.id,
    };
  }

  const packagesRoot =
    process.env.MIGRATION_PACKAGES_DIR?.trim() ||
    path.join(process.cwd(), 'var', 'migration-packages');
  const hasFetch = Boolean(process.env.MIGRATION_RESTORE_PACKAGE_FETCH_URL?.includes('{packageId}'));
  try {
    const stat = await fs.stat(pkg.storedPath);
    const freeHint = process.env.MIGRATION_RESTORE_MIN_FREE_BYTES;
    if (freeHint && stat.size * 2 > Number(freeHint)) {
      return {
        status: 'BLOCKED',
        message: 'Insufficient configured free disk budget for restore (MIGRATION_RESTORE_MIN_FREE_BYTES).',
        requirements,
        packageId: pkg.id,
      };
    }
    assertBackupPathUnderRoot(pkg.storedPath, packagesRoot);
  } catch {
    if (!hasFetch) {
      return {
        status: 'FAILED',
        message: 'Backup file missing on disk and no MIGRATION_RESTORE_PACKAGE_FETCH_URL configured.',
        requirements,
        packageId: pkg.id,
      };
    }
  }

  const dbName = assertSafeSqlServerIdentifier(
    `GatesLegacyRestore_${pkg.id.replace(/-/g, '').slice(0, 12)}`
  );
  return {
    status: 'READY_TO_RUN',
    message: 'Infrastructure checks passed. Restore can be triggered (isolated SQL Server only).',
    requirements,
    packageId: pkg.id,
    estimatedDbName: dbName,
  };
}

export type BakRestoreProgress = {
  onProgress?: (percent: number, message: string) => Promise<void> | void;
};

/** Runs RESTORE on isolated SQL Server with HEADERONLY/FILELISTONLY validation and dynamic MOVE clauses. */
export async function runBakRestore(
  pkg: StoredMigrationPackage,
  progress?: BakRestoreProgress
): Promise<BakRestoreRunResult> {
  const assessment = await assessBakRestore(pkg);
  if (assessment.status !== 'READY_TO_RUN') return assessment;

  const mssql = readIsolatedMssqlEnv();
  if (!mssql) {
    return {
      status: 'BLOCKED',
      message: 'MIGRATION_ISOLATED_MSSQL_HOST and MIGRATION_ISOLATED_MSSQL_SA_PASSWORD required for restore execution.',
      requirements: assessment.requirements,
      packageId: pkg.id,
    };
  }

  const dbName = assertSafeSqlServerIdentifier(assessment.estimatedDbName!);
  let staged: StagedBackup | null = null;
  const timeoutMs = Number(process.env.MIGRATION_RESTORE_TIMEOUT_MS ?? '3600000');

  try {
    await progress?.onProgress?.(15, 'Staging backup for SQL Server');
    staged = await stageBackupForRestore(pkg);

    await progress?.onProgress?.(25, 'Validating backup (HEADERONLY / FILELISTONLY)');
    const { header, files } = await inspectBackupOnIsolatedHost(staged.sqlServerDiskPath, mssql);
    if (!header.backupType) {
      return {
        status: 'FAILED',
        message: 'Could not read the backup header (RESTORE HEADERONLY) — refusing to restore an unverified file.',
        requirements: assessment.requirements,
        packageId: pkg.id,
      };
    }
    if (header.backupType !== '1' && header.backupType !== 'D') {
      return {
        status: 'FAILED',
        message: `Unexpected backup type ${header.backupType} — expected full database backup`,
        requirements: assessment.requirements,
        packageId: pkg.id,
      };
    }
    if (
      process.env.MSSQL_PID?.trim().toUpperCase() === 'EXPRESS' &&
      expressRestoreVerdict(header.backupSizeBytes) === 'too_large'
    ) {
      return {
        status: 'FAILED',
        message:
          'SQL Server Express allows 10 GB of data per database, not a 10 GB .bak. ' +
          `HEADERONLY BackupSize is ${header.backupSizeBytes} bytes, which is already over that data limit.`,
        requirements: assessment.requirements,
        packageId: pkg.id,
      };
    }

    const budget = restoreStorageBudget({
      bakFileBytes: pkg.sizeBytes,
      uncompressedBackupBytes: header.backupSizeBytes,
    });
    const volumeBytes = Number(process.env.MIGRATION_SQL_VOLUME_BYTES ?? '');
    if (Number.isFinite(volumeBytes) && volumeBytes > 0 && budget.total > volumeBytes) {
      return {
        status: 'FAILED',
        message:
          `SQL volume ${volumeBytes} bytes is smaller than the restore needs (${budget.total} bytes: data ${budget.dataBytes}, log ${budget.logBytes}, staging ${budget.stagingBytes}). ` +
          'This is based on HEADERONLY BackupSize, not the .bak size. The 4096 MB upload cap is not the database size.',
        requirements: assessment.requirements,
        packageId: pkg.id,
      };
    }

    const state = parseDatabaseState(
      await runIsolatedSqlcmdQuery(mssql, buildDatabaseStateQuery(dbName), 60_000)
    );
    if (state === 'ONLINE') {
      await deleteBackupObject(pkg);
      return {
        status: 'SUCCEEDED',
        message: `${dbName} is already ONLINE. Restore was not repeated and the database was not overwritten.`,
        requirements: assessment.requirements,
        packageId: pkg.id,
        estimatedDbName: dbName,
        stagedPath: staged.sqlServerDiskPath,
      };
    }
    if (state === 'RESTORING' || state === 'OTHER') {
      await runIsolatedSqlcmdQuery(mssql, buildDropDatabaseSql(dbName), 120_000);
    }

    const { moveSql, dataLogical } = buildRestoreMoveClauses(dbName, files);
    const restoreSql = buildRestoreDatabaseSql(dbName, staged.sqlServerDiskPath, moveSql, header.position ?? 1);

    await progress?.onProgress?.(40, `Restoring to ${dbName}`);
    await runIsolatedSqlcmdQuery(mssql, restoreSql, timeoutMs);

    await progress?.onProgress?.(95, 'Restore complete');
    await deleteBackupObject(pkg);
    return {
      status: 'SUCCEEDED',
      message: `Restored to ${dbName}. Migration Analyze uses BACKUP_RESTORE source config (no LEGACY_FORENSIC_URL).`,
      requirements: assessment.requirements,
      packageId: pkg.id,
      estimatedDbName: dbName,
      stagedPath: staged.sqlServerDiskPath,
      legacyLogicalDataName: dataLogical || header.databaseName || undefined,
    };
  } catch (err) {
    return {
      status: 'FAILED',
      message: err instanceof Error ? err.message : String(err),
      requirements: assessment.requirements,
      packageId: pkg.id,
    };
  } finally {
    if (staged) {
      await cleanupStagedBackup(staged);
    }
  }
}
