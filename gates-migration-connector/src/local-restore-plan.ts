/** Local restore names and RESTORE ... WITH MOVE. Passwords never leave the machine. */

export type BackupFileListEntry = {
  logicalName: string;
  physicalName: string;
  type: string;
  /** FILELISTONLY `Size` in bytes, when the output carried it. */
  sizeBytes?: number;
};

/** One backup set inside a .bak file (RESTORE HEADERONLY row). */
export type BackupSetHeader = {
  position: number;
  backupType: string;
  databaseName: string;
  backupFinishDate: string;
  backupSizeBytes: number | null;
};

export type AgentRestorePlanInput = {
  targetDb: string;
  bakPath: string;
  files: BackupFileListEntry[];
  dataDir: string;
  logDir: string;
  existingDatabaseNames: string[];
  existingPhysicalPaths: string[];
  /** Backup set inside the .bak (RESTORE ... WITH FILE = n). Defaults to 1. */
  fileNumber?: number;
};

export type AgentRestorePlan = {
  targetDb: string;
  sql: string;
  destinations: string[];
  moves: Array<{ logicalName: string; destination: string; type: string }>;
};

/**
 * GatesAgentRestore_<name>[_<yyyymmddHHMM>]. The stamp keeps a second restore of a similarly
 * named backup from colliding with the first (which is never overwritten).
 */
export function agentRestoreDatabaseName(suffix: string, at?: Date): string {
  const safe = suffix.replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
  if (!safe) throw new Error('Restore name suffix is empty');
  if (!at) return `GatesAgentRestore_${safe}`;
  const stamp = at.toISOString().replace(/[^0-9]/g, '').slice(0, 12);
  return `GatesAgentRestore_${safe}_${stamp}`;
}

export function assertCustomerSqlLogin(login: string): void {
  if (/^sa$/i.test(login.trim())) {
    throw new Error('The sa login is not allowed. Use a read-only SQL user. Its password stays on this computer.');
  }
}

export function assertAgentRestoreWillNotOverwrite(existingNames: string[], target: string): void {
  if (!target.startsWith('GatesAgentRestore_')) {
    throw new Error('Agent restore may only create a GatesAgentRestore_ database');
  }
  if (existingNames.some((name) => name.toLowerCase() === target.toLowerCase())) {
    throw new Error(`Database ${target} already exists. The agent will not overwrite it.`);
  }
}

export function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export function quoteNvarchar(value: string): string {
  if (value.includes('\0')) throw new Error('SQL string contains a NUL');
  return `N'${escapeSqlLiteral(value)}'`;
}

export function quoteSqlIdentifier(name: string): string {
  if (!name || name.includes('\0')) throw new Error('Invalid SQL identifier');
  return `[${name.replace(/]/g, ']]')}]`;
}

export function assertSqlDataDirectory(dir: string): string {
  const t = dir.trim();
  if (!t) throw new Error('SQL Server default data directory is empty. The agent will not guess a path.');
  if (t.includes('\0') || t.includes('..')) {
    throw new Error('SQL Server data directory is not allowed');
  }
  if (/[/\\]$/.test(t)) return t;
  return t.includes('/') && !t.includes('\\') ? `${t}/` : `${t}\\`;
}

export function joinSqlDataPath(dir: string, fileName: string): string {
  const base = assertSqlDataDirectory(dir);
  if (!fileName || /[\\/:*?"<>|\0]/.test(fileName) || fileName.includes('..')) {
    throw new Error('Invalid destination file name');
  }
  return `${base}${fileName}`;
}

function normalizeFsPath(p: string): string {
  return p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

/** sqlcmd prints `----|----|----` under the header row: never data. */
function isSqlcmdNoiseLine(trimmed: string): boolean {
  return (
    !trimmed ||
    /^[-|\s]+$/.test(trimmed) ||
    /^\(\d+ rows? affected\)/i.test(trimmed) ||
    /^changed database context/i.test(trimmed)
  );
}

/** Parses sqlcmd `-s "|" -W` RESTORE FILELISTONLY output. */
export function parseFileListOnlyOutput(
  stdout: string,
  opts: { withSizes?: boolean } = {}
): BackupFileListEntry[] {
  const rows: BackupFileListEntry[] = [];
  const seenLogical = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (isSqlcmdNoiseLine(trimmed)) continue;
    if (/^\(\d+ rows affected\)/i.test(trimmed)) continue;
    if (/^changed database context/i.test(trimmed)) continue;
    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length < 3) continue;
    const logicalName = parts[0];
    const physicalName = parts[1];
    const type = parts[2].toUpperCase();
    if (!logicalName || logicalName.toLowerCase() === 'logicalname') continue;
    if (seenLogical.has(logicalName.toLowerCase())) {
      throw new Error(`Backup lists the same logical file twice: ${logicalName}`);
    }
    seenLogical.add(logicalName.toLowerCase());
    // Columns: LogicalName|PhysicalName|Type|FileGroupName|Size|MaxSize|...
    const size = opts.withSizes && parts.length > 4 ? Number(parts[4]) : NaN;
    rows.push({ logicalName, physicalName, type, ...(Number.isFinite(size) && size >= 0 ? { sizeBytes: size } : {}) });
  }
  return rows;
}

export function parseSqlcmdNameColumn(stdout: string, headerName = 'name'): string[] {
  const names: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (isSqlcmdNoiseLine(trimmed)) continue;
    if (trimmed.toLowerCase() === headerName.toLowerCase()) continue;
    const value = trimmed.split('|')[0]?.trim();
    if (value) names.push(value);
  }
  return names;
}

export function parseInstanceDefaultDirs(stdout: string): { dataDir: string; logDir: string } {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (isSqlcmdNoiseLine(trimmed)) continue;
    const parts = trimmed.split('|').map((p) => p.trim());
    if (parts.length < 2) continue;
    if (/data/i.test(parts[0]) && /log/i.test(parts[1]) && !parts[0].includes(':') && !parts[0].includes('\\')) {
      continue;
    }
    if (!parts[0] || !parts[1] || /^null$/i.test(parts[0]) || /^null$/i.test(parts[1])) continue;
    return { dataDir: assertSqlDataDirectory(parts[0]), logDir: assertSqlDataDirectory(parts[1]) };
  }
  throw new Error('Could not read SQL Server InstanceDefaultDataPath / InstanceDefaultLogPath');
}

/** Parses sqlcmd `-s "|" -W` RESTORE HEADERONLY output (header row, separator, one row per set). */
export function parseHeaderOnlyOutput(stdout: string): BackupSetHeader[] {
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => !isSqlcmdNoiseLine(l));
  if (lines.length < 2) return [];
  const headers = lines[0].split('|').map((h) => h.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name.toLowerCase());
  const iPos = col('Position');
  const iType = col('BackupType');
  const iDb = col('DatabaseName');
  const iFinish = col('BackupFinishDate');
  const iSize = col('BackupSize');
  if (iPos < 0 || iType < 0) throw new Error('RESTORE HEADERONLY output has no Position/BackupType columns');
  return lines.slice(1).map((line) => {
    const v = line.split('|').map((x) => x.trim());
    const size = iSize >= 0 ? Number(v[iSize]) : NaN;
    return {
      position: Number(v[iPos]),
      backupType: v[iType] ?? '',
      databaseName: iDb >= 0 ? v[iDb] ?? '' : '',
      backupFinishDate: iFinish >= 0 ? v[iFinish] ?? '' : '',
      backupSizeBytes: Number.isFinite(size) ? size : null,
    };
  }).filter((h) => Number.isInteger(h.position) && h.position > 0);
}

/**
 * The newest full database backup in the file. SSMS appends by default, so position 1 is
 * often the OLDEST backup — restoring it silently would migrate stale data.
 */
export function pickLatestFullBackup(sets: BackupSetHeader[]): BackupSetHeader {
  const full = sets.filter((s) => s.backupType === '1');
  if (full.length === 0) {
    throw new Error('The .bak file has no full database backup (only differential/log backups). Make a full backup.');
  }
  return full.reduce((a, b) => (b.position > a.position ? b : a));
}

/** Bytes the restored data + log files need, from FILELISTONLY sizes (null if unknown). */
export function requiredRestoreBytes(files: BackupFileListEntry[]): number | null {
  if (files.some((f) => f.sizeBytes == null)) return null;
  return files.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);
}

export function destinationFileName(targetDb: string, type: string, indexInType: number): string {
  const kind = type.toUpperCase();
  if (kind === 'L') return indexInType === 1 ? `${targetDb}_log.ldf` : `${targetDb}_log${indexInType}.ldf`;
  if (kind === 'D') return indexInType === 1 ? `${targetDb}.mdf` : `${targetDb}_${indexInType}.ndf`;
  if (kind === 'S') return indexInType === 1 ? `${targetDb}_fs` : `${targetDb}_fs${indexInType}`;
  if (kind === 'F') return indexInType === 1 ? `${targetDb}_ft` : `${targetDb}_ft${indexInType}`;
  throw new Error(`Unsupported backup file type ${type}. The agent will not restore it onto the original path.`);
}

export function planAgentRestore(input: AgentRestorePlanInput): AgentRestorePlan {
  assertAgentRestoreWillNotOverwrite(input.existingDatabaseNames, input.targetDb);
  if (!input.bakPath.toLowerCase().endsWith('.bak')) {
    throw new Error('Choose a .bak file.');
  }
  if (input.files.length === 0) {
    throw new Error('RESTORE FILELISTONLY returned no files. Is the .bak visible to the SQL Server service account?');
  }

  const dataDir = assertSqlDataDirectory(input.dataDir);
  const logDir = assertSqlDataDirectory(input.logDir);
  const occupied = new Set(input.existingPhysicalPaths.map(normalizeFsPath));
  const destinations: string[] = [];
  const moves: AgentRestorePlan['moves'] = [];
  let dataIdx = 0;
  let logIdx = 0;
  let fsIdx = 0;
  let ftIdx = 0;
  let dataCount = 0;
  let logCount = 0;

  for (const file of input.files) {
    if (!file.logicalName.trim()) throw new Error('Backup file is missing a logical name');
    const kind = file.type.toUpperCase();
    let index: number;
    let dir: string;
    if (kind === 'L') {
      logIdx += 1;
      logCount += 1;
      index = logIdx;
      dir = logDir;
    } else if (kind === 'D') {
      dataIdx += 1;
      dataCount += 1;
      index = dataIdx;
      dir = dataDir;
    } else if (kind === 'S') {
      fsIdx += 1;
      index = fsIdx;
      dir = dataDir;
    } else if (kind === 'F') {
      ftIdx += 1;
      index = ftIdx;
      dir = dataDir;
    } else {
      throw new Error(`Unsupported backup file type ${file.type}. The agent will not restore it onto the original path.`);
    }
    const dest = joinSqlDataPath(dir, destinationFileName(input.targetDb, kind, index));
    const key = normalizeFsPath(dest);
    if (occupied.has(key) || destinations.some((d) => normalizeFsPath(d) === key)) {
      throw new Error(`Destination file path is already in use: ${dest}. The agent will not overwrite it.`);
    }
    occupied.add(key);
    destinations.push(dest);
    moves.push({ logicalName: file.logicalName, destination: dest, type: kind });
  }

  if (dataCount < 1 || logCount < 1) {
    throw new Error('Backup must contain at least one data file and one log file');
  }

  const moveSql = moves
    .map((m) => `MOVE ${quoteNvarchar(m.logicalName)} TO ${quoteNvarchar(m.destination)}`)
    .join(',\n  ');

  const destListSql = destinations.map((d) => quoteNvarchar(d)).join(', ');
  const dbId = quoteNvarchar(input.targetDb);
  const disk = quoteNvarchar(input.bakPath);
  const ident = quoteSqlIdentifier(input.targetDb);

  const fileNumber = input.fileNumber ?? 1;
  if (!Number.isInteger(fileNumber) || fileNumber < 1) throw new Error('Invalid backup set number');

  const sql = [
    'SET NOCOUNT ON;',
    `IF DB_ID(${dbId}) IS NOT NULL THROW 50000, N'Database already exists. The agent will not overwrite it.', 1;`,
    `IF EXISTS (SELECT 1 FROM sys.master_files WHERE LOWER(physical_name) IN (${destListSql})) THROW 50001, N'Destination file path is already used by another database. The agent will not overwrite it.', 1;`,
    `RESTORE DATABASE ${ident}`,
    `FROM DISK = ${disk}`,
    'WITH',
    `  FILE = ${fileNumber},`,
    `  ${moveSql},`,
    '  RECOVERY, STATS = 10;',
  ].join('\n');

  const sqlCode = sql.replace(/N?'(?:''|[^'])*'/g, "''");
  if (/\bREPLACE\b/i.test(sqlCode)) {
    throw new Error('Restore SQL must not contain REPLACE');
  }
  if (/\bDROP\s+DATABASE\b/i.test(sqlCode)) {
    throw new Error('Restore SQL must not drop a database');
  }

  return { targetDb: input.targetDb, sql, destinations, moves };
}

export function buildAgentRestoreSql(input: AgentRestorePlanInput): string {
  return planAgentRestore(input).sql;
}
