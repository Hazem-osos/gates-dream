import { assertSafeSqlServerIdentifier } from '../migration-sql-safety';
import {
  readIsolatedMssqlEnv,
  runIsolatedSqlcmdQuery,
  sqlDiskLiteral,
  type IsolatedMssqlEnv,
} from './migration-bak-sqlcmd';

export type BackupFileListEntry = {
  logicalName: string;
  physicalName: string;
  type: 'D' | 'L' | 'S' | 'F' | string;
};

export type BackupHeaderSummary = {
  databaseName: string | null;
  backupSizeBytes: number | null;
  backupType: string | null;
  /** Backup set inside the .bak (RESTORE ... WITH FILE = n); the newest full backup. */
  position?: number;
  backupFinishDate?: string | null;
};

/** sqlcmd prints `----|----` under the header row: never data. */
function isSeparatorLine(line: string): boolean {
  return /^[-|\s]+$/.test(line);
}

/** Parses sqlcmd pipe-delimited RESTORE FILELISTONLY output (one row per line). */
export function parseFileListOnlyOutput(stdout: string): BackupFileListEntry[] {
  const rows: BackupFileListEntry[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || isSeparatorLine(trimmed) || /^\(\d+ rows? affected\)/i.test(trimmed)) continue;
    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length < 3) continue;
    const logicalName = parts[0];
    const physicalName = parts[1];
    const type = parts[2];
    if (!logicalName || logicalName.toLowerCase() === 'logicalname') continue;
    rows.push({ logicalName, physicalName, type });
  }
  return rows;
}

/**
 * Parses RESTORE HEADERONLY sqlcmd pipe output (header row, then one row per backup set) and
 * returns the NEWEST full database backup. A .bak often holds several appended backups; set 1
 * is the oldest, so restoring it by default would migrate stale data.
 */
export function parseHeaderOnlyOutput(stdout: string): BackupHeaderSummary {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !isSeparatorLine(l) && !/^\(\d+ rows? affected\)/i.test(l));
  if (lines.length < 2) {
    return { databaseName: null, backupSizeBytes: null, backupType: null };
  }
  const headers = lines[0].split('|').map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const values = line.split('|').map((v) => v.trim());
    const at = (col: string) => {
      const i = headers.indexOf(col);
      return i >= 0 ? values[i] : undefined;
    };
    const sizeRaw = at('backupsize');
    const position = Number(at('position') ?? '1');
    return {
      databaseName: at('databasename') || null,
      backupSizeBytes: sizeRaw ? Number(String(sizeRaw).replace(/,/g, '')) : null,
      backupType: at('backuptype') || null,
      position: Number.isInteger(position) && position > 0 ? position : 1,
      backupFinishDate: at('backupfinishdate') || null,
    };
  });
  const full = rows.filter((r) => r.backupType === '1');
  const pool = full.length ? full : rows;
  return pool.reduce((a, b) => (b.position > a.position ? b : a));
}

export function buildRestoreMoveClauses(
  targetDbName: string,
  files: BackupFileListEntry[]
): { moveSql: string; dataLogical: string; logLogical: string } {
  const safeDb = assertSafeSqlServerIdentifier(targetDbName);
  let dataIdx = 0;
  let logIdx = 0;
  const moves: string[] = [];
  let dataLogical = '';
  let logLogical = '';
  for (const f of files) {
    const logical = f.logicalName.replace(/'/g, "''");
    if (f.type === 'L') {
      logIdx += 1;
      const suffix = logIdx === 1 ? '_log' : `_log${logIdx}`;
      const path = `/var/opt/mssql/data/${safeDb}${suffix}.ldf`;
      moves.push(`MOVE '${logical}' TO N'${path.replace(/'/g, "''")}'`);
      if (!logLogical) logLogical = f.logicalName;
    } else if (f.type === 'F') {
      // Full-text catalog: a directory, moved next to the data files.
      moves.push(`MOVE '${logical}' TO N'/var/opt/mssql/data/${safeDb}_ft'`);
    } else if (f.type === 'D' || f.type === 'S') {
      dataIdx += 1;
      const ext = dataIdx === 1 ? '.mdf' : `${dataIdx}.ndf`;
      const path = `/var/opt/mssql/data/${safeDb}${ext}`;
      moves.push(`MOVE '${logical}' TO N'${path.replace(/'/g, "''")}'`);
      if (!dataLogical) dataLogical = f.logicalName;
    }
  }
  if (moves.length === 0) {
    throw new Error('RESTORE FILELISTONLY returned no data/log files');
  }
  return { moveSql: moves.join(',\n'), dataLogical, logLogical };
}

export function buildDatabaseStateQuery(dbName: string): string {
  const safe = assertSafeSqlServerIdentifier(dbName);
  return `SET NOCOUNT ON; SELECT CASE WHEN DB_ID(N'${safe}') IS NULL THEN 'ABSENT' ELSE COALESCE((SELECT state_desc FROM sys.databases WHERE name = N'${safe}'), 'ABSENT') END;`;
}

export function parseDatabaseState(stdout: string): 'ABSENT' | 'ONLINE' | 'RESTORING' | 'OTHER' {
  const line = stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s && !/^-+$/.test(s) && !/^state/i.test(s));
  const value = (line ?? '').toUpperCase();
  if (!value || value.includes('ABSENT')) return 'ABSENT';
  if (value === 'ONLINE') return 'ONLINE';
  if (value === 'RESTORING' || value === 'RECOVERING') return 'RESTORING';
  return 'OTHER';
}

export function buildDropDatabaseSql(dbName: string): string {
  const safe = assertSafeSqlServerIdentifier(dbName);
  return `IF DB_ID(N'${safe}') IS NOT NULL BEGIN ALTER DATABASE [${safe}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${safe}]; END`;
}

export function buildRestoreDatabaseSql(
  targetDbName: string,
  backupPathOnSqlHost: string,
  moveSql: string,
  fileNumber = 1
): string {
  const safeDb = assertSafeSqlServerIdentifier(targetDbName);
  const disk = sqlDiskLiteral(backupPathOnSqlHost);
  if (!Number.isInteger(fileNumber) || fileNumber < 1) throw new Error('Invalid backup set number');
  return `
RESTORE DATABASE [${safeDb}]
FROM DISK = ${disk}
WITH FILE = ${fileNumber},
${moveSql},
RECOVERY, STATS = 5;
`.trim();
}

export async function inspectBackupOnIsolatedHost(
  backupPathOnSqlHost: string,
  env: IsolatedMssqlEnv = readIsolatedMssqlEnv()!
): Promise<{ header: BackupHeaderSummary; files: BackupFileListEntry[] }> {
  const timeoutMs = Number(process.env.MIGRATION_RESTORE_INSPECT_TIMEOUT_MS ?? '120000');
  const disk = sqlDiskLiteral(backupPathOnSqlHost);
  // Headers on: the parser locates columns by name.
  const headerOut = await runIsolatedSqlcmdQuery(
    env,
    `RESTORE HEADERONLY FROM DISK = ${disk};`,
    timeoutMs,
    { headers: true }
  );
  const header = parseHeaderOnlyOutput(headerOut);
  const fileOut = await runIsolatedSqlcmdQuery(
    env,
    `RESTORE FILELISTONLY FROM DISK = ${disk} WITH FILE = ${header.position ?? 1};`,
    timeoutMs
  );
  const files = parseFileListOnlyOutput(fileOut);
  if (files.length === 0) {
    throw new Error('Could not read backup file list — is the .bak visible to SQL Server?');
  }
  return { header, files };
}
