import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';

export interface BackupOptions {
  name: string;
  path?: string;
  includeData?: boolean;
  includeSchema?: boolean;
}

export interface RestoreOptions {
  backupFile: string;
  restoreData?: boolean;
  restoreSchema?: boolean;
}

/**
 * SECURITY: this service used to shell out to `mysqldump`/`mysql` against the entire
 * database instance — every tenant's data, not just the caller's company — and
 * `listBackups` read a shared directory with no per-tenant filtering. There is no
 * tenant-safe way to offer a full-instance dump/restore from a per-company API, so the
 * feature is disabled here rather than left reachable. A proper per-tenant export lives in
 * `export-import.service.ts`; a real backup/restore tool belongs in ops infrastructure
 * (e.g. a scheduled `mysqldump` run by an operator), not behind a tenant-facing endpoint.
 */
export class DatabaseBackupService {
  async createBackup(companyId: string, options: BackupOptions): Promise<{ filePath: string; size: number }> {
    logger.warn({ companyId, options }, 'Blocked attempt to use disabled full-instance database backup');
    throw new AppError(
      403,
      'Database backup is disabled: it dumps the entire database instance, not just this company\'s data. Use Export Data for a per-tenant export, or contact a system administrator.'
    );
  }

  async restoreBackup(companyId: string, options: RestoreOptions): Promise<void> {
    logger.warn({ companyId, options }, 'Blocked attempt to use disabled full-instance database restore');
    throw new AppError(
      403,
      'Database restore is disabled: it overwrites the entire database instance for every tenant. Contact a system administrator to restore from an infrastructure-level backup.'
    );
  }

  async listBackups(companyId: string, backupPath?: string): Promise<Array<{ name: string; path: string; size: number; createdAt: Date }>> {
    logger.warn({ companyId, backupPath }, 'Blocked attempt to list disabled full-instance database backups');
    throw new AppError(403, 'Database backup listing is disabled for tenant accounts.');
  }
}

export const databaseBackupService = new DatabaseBackupService();

