import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { assertBackupPathUnderRoot } from '../migration-sql-safety';
import type { StoredMigrationPackage } from './migration-package.storage';
import {
  downloadBackupObject,
  downloadFetchResumable,
  migrationObjectStorageConfigured,
  sha256File,
} from './migration-bak-transport';

export type StagedBackup = {
  /** Path as seen by the isolated SQL Server process (RESTORE FROM DISK). */
  sqlServerDiskPath: string;
  /** Local path on restore worker (for cleanup). */
  localPath: string;
  copied: boolean;
};

function packagesRoot(): string {
  return (
    process.env.MIGRATION_PACKAGES_DIR?.trim() ||
    path.join(process.cwd(), 'var', 'migration-packages')
  );
}

function isolatedBackupDir(): string {
  return (
    process.env.MIGRATION_ISOLATED_BACKUP_DIR?.trim() ||
    process.env.MIGRATION_SQL_BACKUP_MOUNT_PATH?.trim() ||
    '/var/opt/mssql/data/backups'
  );
}

function sqlPathForLocalFile(localPath: string): string {
  const mapFrom = process.env.MIGRATION_SQL_BACKUP_PATH_PREFIX?.trim();
  const mapTo = process.env.MIGRATION_ISOLATED_BACKUP_DIR?.trim();
  if (mapFrom && mapTo && localPath.startsWith(mapFrom)) {
    return mapTo + localPath.slice(mapFrom.length);
  }
  return localPath;
}

async function hashOrNull(filePath: string): Promise<string | null> {
  try {
    await fs.stat(filePath);
  } catch {
    return null;
  }
  return sha256File(filePath);
}

/**
 * Copies a verified .bak into the directory SQL Server reads (RESTORE FROM DISK).
 * Order: reuse a checksum-matching file, else S3, else the private API fetch, else a local file.
 */
export async function stageBackupForRestore(pkg: StoredMigrationPackage): Promise<StagedBackup> {
  const destDir = isolatedBackupDir();
  const destPath = path.join(destDir, `${pkg.id}.bak`);
  const partialPath = `${destPath}.partial`;
  await fs.mkdir(destDir, { recursive: true });

  if ((await hashOrNull(destPath)) === pkg.sha256) {
    return {
      sqlServerDiskPath: sqlPathForLocalFile(destPath),
      localPath: destPath,
      copied: false,
    };
  }

  if (migrationObjectStorageConfigured()) {
    await downloadBackupObject(pkg, partialPath);
  } else {
    const fetchTemplate = process.env.MIGRATION_RESTORE_PACKAGE_FETCH_URL?.trim();
    if (fetchTemplate?.includes('{packageId}')) {
      const url = fetchTemplate.replace('{packageId}', pkg.id).replace('{companyId}', pkg.companyId);
      await downloadFetchResumable(url, partialPath, process.env.MIGRATION_RESTORE_FETCH_TOKEN?.trim() ?? '');
    } else {
      const sourcePath = assertBackupPathUnderRoot(pkg.storedPath, packagesRoot());
      const stat = await fs.stat(sourcePath).catch(() => null);
      if (!stat?.isFile()) {
        throw new Error(
          'Backup file is not on this service. Set MIGRATION_S3_* or MIGRATION_RESTORE_PACKAGE_FETCH_URL.'
        );
      }
      if (path.resolve(sourcePath) !== path.resolve(destPath)) {
        const { createReadStream, createWriteStream } = await import('node:fs');
        await pipeline(createReadStream(sourcePath), createWriteStream(partialPath));
      }
    }
  }

  const stagedPath = (await hashOrNull(partialPath)) ? partialPath : destPath;
  const actual = await sha256File(stagedPath);
  if (actual !== pkg.sha256) {
    await fs.unlink(partialPath).catch(() => undefined);
    throw new Error('Backup checksum mismatch — SQL Server will not restore this file');
  }
  if (stagedPath === partialPath) {
    await fs.rename(partialPath, destPath);
  }
  return {
    sqlServerDiskPath: sqlPathForLocalFile(destPath),
    localPath: destPath,
    copied: true,
  };
}

export async function cleanupStagedBackup(staged: StagedBackup): Promise<void> {
  if (!staged.copied) return;
  if (process.env.MIGRATION_RESTORE_KEEP_STAGED_BAK === 'true') return;
  try {
    await fs.unlink(staged.localPath);
  } catch {
    /* best effort */
  }
}
