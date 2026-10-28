import path from 'node:path';
import { MigrationTargetSafetyError } from './target-safety';

/** SQL Server bracket identifier — blocks injection via db/file names. */
export function assertSafeSqlServerIdentifier(name: string): string {
  const trimmed = name.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(trimmed)) {
    throw new MigrationTargetSafetyError(`Unsafe SQL Server identifier: ${name}`);
  }
  return trimmed;
}

/** Ensure a backup path stays under the configured packages root. */
export function assertBackupPathUnderRoot(storedPath: string, packagesRoot: string): string {
  const resolved = path.resolve(storedPath);
  const root = path.resolve(packagesRoot);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new MigrationTargetSafetyError('Backup path escapes migration package storage root');
  }
  return resolved;
}

function mysqlHostFromDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl?.trim()) return '';
  try {
    return new URL(databaseUrl.replace(/^mysql:\/\//, 'http://')).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Isolated restore SQL must not be the Gates MySQL target.
 * Hosts whose names contain railway/prod are refused unless the operator
 * explicitly marks a separate SQL Server service (`MIGRATION_ISOLATED_MSSQL_DEDICATED=true`).
 */
export function isolatedMssqlHostRejection(
  host: string | undefined,
  opts?: { databaseUrl?: string; dedicated?: boolean }
): string | null {
  const raw = host?.trim() ?? '';
  if (!raw) return 'Isolated SQL Server host is not configured.';
  const hostOnly = raw.split(',')[0].split(':')[0].toLowerCase();
  const mysqlHost = mysqlHostFromDatabaseUrl(opts?.databaseUrl ?? process.env.DATABASE_URL);
  if (mysqlHost && hostOnly === mysqlHost) {
    return 'Isolated SQL host must not be the Gates MySQL target.';
  }
  const dedicated = opts?.dedicated ?? process.env.MIGRATION_ISOLATED_MSSQL_DEDICATED === 'true';
  if (/railway|prod|production/i.test(raw) && !dedicated) {
    return (
      'Isolated SQL Server host looks like a shared or production name. ' +
      'Set MIGRATION_ISOLATED_MSSQL_DEDICATED=true only for a separate SQL Server restore service, not the app MySQL.'
    );
  }
  return null;
}

export function escapeSqlStringLiteral(value: string): string {
  return value.replace(/'/g, "''");
}
