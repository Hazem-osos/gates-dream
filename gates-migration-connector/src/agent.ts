import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { statfsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import {
  agentRestoreDatabaseName,
  assertCustomerSqlLogin,
  parseFileListOnlyOutput,
  parseHeaderOnlyOutput,
  parseInstanceDefaultDirs,
  pickLatestFullBackup,
  requiredRestoreBytes,
  parseSqlcmdNameColumn,
  planAgentRestore,
  quoteNvarchar,
  quoteSqlIdentifier,
} from './local-restore-plan.js';
import { ALLOWED_LEGACY_TABLES, assertReadOnlySelectSql, handleConnectorOp } from './connector-ops.js';
import { startConnectorLoop } from './connector-loop.js';

export const AGENT_VERSION = '0.2.4';

const API = process.env.GATES_API_BASE?.replace(/\/$/, '') ?? '';

function parseAgentFlags(argv: string[]): 'version' | 'self-test' | null {
  if (argv.includes('--version') || argv.includes('-v')) return 'version';
  if (argv.includes('--self-test')) return 'self-test';
  return null;
}

async function runSelfTest(): Promise<void> {
  if (typeof handleConnectorOp !== 'function' || ALLOWED_LEGACY_TABLES.size === 0) {
    throw new Error('connector-ops bundle incomplete');
  }
  assertReadOnlySelectSql('SELECT 1 AS ok');
  const db = agentRestoreDatabaseName('sample');
  if (!db.startsWith('GatesAgentRestore_')) {
    throw new Error(`unexpected restore name ${db}`);
  }
  assertCustomerSqlLogin('gates_reader');
  const sql = planAgentRestore({
    targetDb: db,
    bakPath: 'C:\\tmp\\sample.bak',
    files: [
      { logicalName: 'sample', physicalName: 'C:\\data\\sample.mdf', type: 'D' },
      { logicalName: 'sample_log', physicalName: 'C:\\data\\sample_log.ldf', type: 'L' },
    ],
    dataDir: 'C:\\Program Files\\Microsoft SQL Server\\MSSQL16.MSSQLSERVER\\MSSQL\\DATA\\',
    logDir: 'C:\\Program Files\\Microsoft SQL Server\\MSSQL16.MSSQLSERVER\\MSSQL\\DATA\\',
    existingDatabaseNames: ['master', 'sample'],
    existingPhysicalPaths: ['C:\\data\\sample.mdf', 'C:\\data\\sample_log.ldf'],
  }).sql;
  if (!/\bMOVE\b/i.test(sql) || !/\bRESTORE\s+DATABASE\b/i.test(sql) || /\bREPLACE\b/i.test(sql)) {
    throw new Error('restore SQL missing MOVE or contains REPLACE');
  }
  if (sql.includes('C:\\data\\sample.mdf')) {
    throw new Error('restore SQL reused the source file path');
  }
  const sets = parseHeaderOnlyOutput(
    ['BackupName|BackupType|Position|DatabaseName|BackupFinishDate|BackupSize', '----|----|----|----|----|----',
      'a|1|1|Gates|2026-01-01 10:00:00|100', 'b|5|2|Gates|2026-01-02 10:00:00|50', 'c|1|3|Gates|2026-02-01 10:00:00|120'].join('\n')
  );
  if (pickLatestFullBackup(sets).position !== 3) throw new Error('backup set selection is not the newest full backup');
  const files = parseFileListOnlyOutput(
    ['LogicalName|PhysicalName|Type|FileGroupName|Size', '----|----|----|----|----', 'g|C:\\d\\g.mdf|D|PRIMARY|1024', 'g_log|C:\\d\\g.ldf|L||512'].join('\n'),
    { withSizes: true }
  );
  if (files.length !== 2 || requiredRestoreBytes(files) !== 1536) throw new Error('FILELISTONLY parsing failed');
  try {
    assertReadOnlySelectSql('SELECT * FROM OtherDb.dbo.Customer');
    throw new Error('cross-database read was not blocked');
  } catch (err) {
    if (err instanceof Error && err.message === 'cross-database read was not blocked') throw err;
  }
  console.log(`GatesMigrationAgent ${AGENT_VERSION} self-test ok`);
}

async function ask(prompt: string, fallback = ''): Promise<string> {
  if (!input.isTTY) return fallback;
  const rl = createInterface({ input, output });
  const answer = (await rl.question(prompt)).trim();
  rl.close();
  return answer || fallback;
}

/** Reads a secret without echoing it (falls back to the default when not interactive). */
async function askSecret(prompt: string, fallback = ''): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== 'function') return fallback;
  output.write(prompt);
  return new Promise((resolve) => {
    let value = '';
    const onData = (chunk: Buffer) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\r' || ch === '\n') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          output.write('\n');
          resolve(value || fallback);
          return;
        }
        if (ch === '\u0003') process.exit(130); // Ctrl+C
        if (ch === '\u0008' || ch === '\u007f') value = value.slice(0, -1);
        else value += ch;
      }
    };
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

type SavedSession = { api: string; token: string; deviceId: string | null; pairedAt: string };

const SESSION_FILE = path.join(os.homedir(), '.gates-migration-agent', 'session.json');

/** The connector token is kept in the Windows user's profile so a restart does not need a new code. */
async function loadSession(api: string): Promise<SavedSession | null> {
  try {
    const saved = JSON.parse(await readFile(SESSION_FILE, 'utf8')) as Partial<SavedSession>;
    if (saved.token && saved.api === api) {
      return { api, token: saved.token, deviceId: saved.deviceId ?? null, pairedAt: saved.pairedAt ?? '' };
    }
  } catch {
    /* no saved pairing */
  }
  return null;
}

async function saveSession(session: SavedSession) {
  await mkdir(path.dirname(SESSION_FILE), { recursive: true });
  await writeFile(SESSION_FILE, JSON.stringify(session, null, 2), { mode: 0o600 });
}

async function forgetSession() {
  await rm(SESSION_FILE, { force: true });
}

async function fatal(message: string): Promise<never> {
  console.error(message);
  if (input.isTTY) {
    await ask('Press Enter to close... ');
  }
  process.exit(1);
}

async function pair(api: string, code: string): Promise<{ token: string; deviceId?: string }> {
  console.info('Pairing with Gates…');
  const res = await fetch(`${api}/connector/v1/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairingCode: code, label: os.hostname() || 'Windows agent', connectorVersion: AGENT_VERSION }),
  });
  const raw = await res.text();
  let body: {
    status?: string;
    data?: { connectorToken?: string; deviceId?: string };
    message?: string;
  } = {};
  try {
    body = raw ? (JSON.parse(raw) as typeof body) : {};
  } catch {
    throw new Error(
      `Pairing failed (${res.status}). Check the API address ends with /api/v1/migration-engine. Server said: ${raw.slice(0, 180)}`
    );
  }
  if (!res.ok || !body.data?.connectorToken) {
    const msg = body.message || `Pairing failed (${res.status})`;
    if (/authentication required/i.test(msg)) {
      throw new Error(
        'Gates rejected pairing (Authentication required). The API must allow connector/v1/pair without a user login. Ask for a backend deploy of that exemption, then create a new pairing code.'
      );
    }
    throw new Error(msg);
  }
  return { token: body.data.connectorToken, deviceId: body.data.deviceId };
}

function sqlcmdOnError(err: unknown): Error {
  if (err && typeof err === 'object' && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
    return new Error('sqlcmd is not installed. Install SQL Server command-line tools, or choose an existing database.');
  }
  return err instanceof Error ? err : new Error(String(err));
}

function sqlcmd(server: string, user: string, password: string, query: string, opts?: { capture?: boolean }): Promise<string> {
  // -W (trim) cannot be combined with -y/-Y; -W + -s '|' gives a parseable header + rows.
  const args = ['-S', server, '-U', user, '-C', '-b', '-s', '|', '-W', '-Q', query];
  return new Promise((resolve, reject) => {
    const child = spawn('sqlcmd', args, {
      stdio: opts?.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: { ...process.env, SQLCMDPASSWORD: password },
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (err) => reject(sqlcmdOnError(err)));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      const detail = (stderr || stdout).trim();
      reject(new Error(detail ? `sqlcmd exited ${code}: ${detail}` : `sqlcmd exited ${code}`));
    });
  });
}

async function resolveSqlDataDirs(server: string, user: string, password: string) {
  try {
    const dirOut = await sqlcmd(
      server,
      user,
      password,
      "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(4000)) AS data_path, CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(4000)) AS log_path;",
      { capture: true }
    );
    return parseInstanceDefaultDirs(dirOut);
  } catch {
    const fallback = await sqlcmd(
      server,
      user,
      password,
      "SET NOCOUNT ON; SELECT MAX(CASE WHEN type = 0 THEN LEFT(physical_name, LEN(physical_name) - CHARINDEX('\\', REVERSE(REPLACE(physical_name,'/','\\'))) + 1) END) AS data_path, MAX(CASE WHEN type = 1 THEN LEFT(physical_name, LEN(physical_name) - CHARINDEX('\\', REVERSE(REPLACE(physical_name,'/','\\'))) + 1) END) AS log_path FROM sys.master_files WHERE database_id = 1;",
      { capture: true }
    );
    return parseInstanceDefaultDirs(fallback);
  }
}

/** Free bytes on the volume holding `dir`, when SQL Server runs on this computer (else null). */
function localFreeBytes(dir: string, server: string): number | null {
  const host = server.split(/[\\,:]/)[0].trim().toLowerCase();
  if (!['localhost', '.', '(local)', '127.0.0.1', os.hostname().toLowerCase()].includes(host)) return null;
  try {
    const st = statfsSync(dir);
    return Number(st.bavail) * Number(st.bsize);
  } catch {
    return null;
  }
}

async function restoreBakLocally(bakPath: string, server: string, user: string, password: string): Promise<string> {
  const db = agentRestoreDatabaseName(path.basename(bakPath, path.extname(bakPath)), new Date());

  // A .bak can hold several backups (SSMS appends by default). Use the newest FULL one and
  // show the customer which one it is before anything is restored.
  const headerOut = await sqlcmd(server, user, password, `SET NOCOUNT ON; RESTORE HEADERONLY FROM DISK = ${quoteNvarchar(bakPath)};`, {
    capture: true,
  });
  const chosen = pickLatestFullBackup(parseHeaderOnlyOutput(headerOut));
  console.info(
    `Backup to restore: database "${chosen.databaseName}", finished ${chosen.backupFinishDate} (backup #${chosen.position} in the file).`
  );
  const confirm = (await ask('Restore this backup into a NEW database? Type YES to continue: ', '')).trim();
  if (confirm.toUpperCase() !== 'YES') {
    throw new Error('Restore cancelled. Nothing was changed.');
  }
  const existingNames = parseSqlcmdNameColumn(
    await sqlcmd(server, user, password, 'SET NOCOUNT ON; SELECT name FROM sys.databases;', { capture: true }),
    'name'
  );
  const dirs = await resolveSqlDataDirs(server, user, password);
  const existingPaths = parseSqlcmdNameColumn(
    await sqlcmd(server, user, password, 'SET NOCOUNT ON; SELECT physical_name FROM sys.master_files;', { capture: true }),
    'physical_name'
  );
  const listOut = await sqlcmd(
    server,
    user,
    password,
    `SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = ${quoteNvarchar(bakPath)} WITH FILE = ${chosen.position};`,
    { capture: true }
  );
  const files = parseFileListOnlyOutput(listOut, { withSizes: true });
  const needed = requiredRestoreBytes(files);
  const free = localFreeBytes(dirs.dataDir, server);
  if (needed != null && free != null && free < needed * 1.1) {
    throw new Error(
      `Not enough disk space for the restore: needs about ${Math.ceil(needed / 1e9)} GB, ${Math.floor(free / 1e9)} GB free on the SQL Server data drive.`
    );
  }
  const plan = planAgentRestore({
    fileNumber: chosen.position,
    targetDb: db,
    bakPath,
    files,
    dataDir: dirs.dataDir,
    logDir: dirs.logDir,
    existingDatabaseNames: existingNames,
    existingPhysicalPaths: existingPaths,
  });
  console.info(`Restoring to a new local database ${plan.targetDb}. The original database will not be changed.`);
  await sqlcmd(server, user, password, plan.sql);
  return plan.targetDb;
}

/**
 * The restored copy keeps the backup's own users, so no login of this server can open it yet
 * (verified on SQL Server 2022: even its new owner cannot). Map the read-only login into the
 * copy and make the copy read-only. Needs the restore login to be an administrator.
 */
async function grantReaderOnRestoredCopy(
  server: string,
  adminUser: string,
  adminPassword: string,
  db: string,
  readerLogin: string
): Promise<void> {
  const grantSql = buildReaderGrantSql(db, readerLogin);
  try {
    await sqlcmd(server, adminUser, adminPassword, grantSql, { capture: true });
  } catch (err) {
    throw new Error(
      `The backup was restored to ${db}, but the login ${adminUser} cannot give ${readerLogin} read access to it ` +
        `(${err instanceof Error ? err.message : String(err)}). Ask your database administrator to run:\n\n${grantSql}\n\n` +
        'then start the agent again in mode 1 with that database name.'
    );
  }
  console.info(`${readerLogin} can read ${db}; the copy is now read-only.`);
}

export function buildReaderGrantSql(db: string, readerLogin: string): string {
  const dbId = quoteSqlIdentifier(db);
  const login = quoteSqlIdentifier(readerLogin);
  return [
    'SET NOCOUNT ON;',
    `USE ${dbId};`,
    `IF USER_ID(${quoteNvarchar(readerLogin)}) IS NULL CREATE USER ${login} FOR LOGIN ${login};`,
    `ALTER ROLE [db_datareader] ADD MEMBER ${login};`,
    'USE [master];',
    `ALTER DATABASE ${dbId} SET READ_ONLY WITH ROLLBACK IMMEDIATE;`,
  ].join('\n');
}

async function main() {
  const flag = parseAgentFlags(process.argv.slice(2));
  if (flag === 'version') {
    console.log(`GatesMigrationAgent ${AGENT_VERSION}`);
    return;
  }
  if (flag === 'self-test') {
    await runSelfTest();
    return;
  }

  const api = (await ask('Gates API base (…/api/v1/migration-engine): ', API)).replace(/\/$/, '');
  if (!api) {
    await fatal('API address is required.');
  }
  // Reuse this computer's earlier pairing (same Gates address) unless the user wants a new one.
  const saved = process.env.CONNECTOR_TOKEN ? null : await loadSession(api);
  if (saved && (await ask(`Use the existing pairing from ${saved.pairedAt || 'earlier'}? [Y/n]: `, 'y')).toLowerCase() !== 'n') {
    process.env.CONNECTOR_TOKEN = saved.token;
    console.info('Using the saved pairing. If Gates rejects it, the agent will ask for a new pairing code.');
  } else if (saved) {
    await forgetSession();
  }
  const code = process.env.CONNECTOR_TOKEN
    ? ''
    : await ask('Pairing code from the Gates wizard: ', process.env.GATES_PAIRING_CODE ?? '');
  if (!process.env.CONNECTOR_TOKEN && !code) {
    await fatal('A pairing code is required.');
  }
  const paired = process.env.CONNECTOR_TOKEN
    ? { token: process.env.CONNECTOR_TOKEN, deviceId: undefined as string | undefined }
    : await pair(api, code);
  const token = paired.token;
  if (!process.env.CONNECTOR_TOKEN) {
    await saveSession({ api, token, deviceId: paired.deviceId ?? null, pairedAt: new Date().toISOString() });
  }
  console.info('Paired. The connector token stays on this computer.');
  if (paired.deviceId) console.info(`Device ID: ${paired.deviceId}`);

  const mode = (await ask('Mode: 1 existing database, 2 local .bak restore [1]: ', '1')).trim();
  const server = await ask('SQL Server (localhost): ', process.env.LEGACY_MSSQL_SERVER ?? 'localhost');
  const user = await ask('SQL login (read-only, not sa): ', process.env.LEGACY_MSSQL_USER ?? '');
  const password = await askSecret('SQL password (hidden, not sent to Gates): ', process.env.LEGACY_MSSQL_PASSWORD ?? '');
  let database = await ask('Database name (existing database mode): ', process.env.LEGACY_MSSQL_DATABASE ?? '');
  if (!user || !password) {
    await fatal('Database, login, and password are required. Nothing was sent to Gates.');
  }
  try {
    assertCustomerSqlLogin(user);
  } catch (err) {
    await fatal(err instanceof Error ? err.message : String(err));
  }
  if (mode === '2') {
    const bak = await ask('Full path to the .bak file: ', '');
    if (!bak.toLowerCase().endsWith('.bak')) {
      await fatal('Choose a .bak file.');
    }
    // Restoring needs an administrator login; it is used for the restore and the read grant
    // only, never stored, never sent to Gates. Gates then reads with the read-only login above.
    const adminUser = await ask('Administrator SQL login for the restore only (sysadmin): ', process.env.LEGACY_RESTORE_USER ?? '');
    const adminPassword = await askSecret('Administrator password (hidden, used once): ', process.env.LEGACY_RESTORE_PASSWORD ?? '');
    if (!adminUser || !adminPassword) {
      await fatal('The restore needs an administrator login. Nothing was changed.');
    }
    database = await restoreBakLocally(bak, server, adminUser, adminPassword);
    await grantReaderOnRestoredCopy(server, adminUser, adminPassword, database, user);
  }
  if (!database || !user || !password) {
    await fatal('Database, login, and password are required. Nothing was sent to Gates.');
  }
  process.env.GATES_API_BASE = api;
  process.env.CONNECTOR_TOKEN = token;
  process.env.LEGACY_MSSQL_SERVER = server;
  process.env.LEGACY_MSSQL_DATABASE = database;
  process.env.LEGACY_MSSQL_USER = user;
  process.env.LEGACY_MSSQL_PASSWORD = password;
  process.env.LEGACY_MSSQL_URL = `Server=${server};Database=${database};User Id=${user};Password=${password};Encrypt=false;TrustServerCertificate=true`;
  console.info('Connecting to SQL Server. Keep this window open. Do not create the job while this window is closed.');
  try {
    await startConnectorLoop();
  } catch (err) {
    // A revoked pairing must not be offered again on the next start.
    if (err instanceof Error && /no longer accepts this agent/i.test(err.message)) await forgetSession();
    throw err;
  }
}

void main()
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    if (input.isTTY) {
      await ask('Press Enter to close... ');
    }
    process.exit(1);
  });
