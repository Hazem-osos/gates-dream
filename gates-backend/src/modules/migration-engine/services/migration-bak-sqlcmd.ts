import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { assertSafeSqlServerIdentifier, escapeSqlStringLiteral } from '../migration-sql-safety';

/** Statements that create a db_datareader login and mark the restored DB read-only. SA is not stored for later reads. */
export function buildRestoreReaderStatements(dbName: string, login: string, password: string): string[] {
  const db = assertSafeSqlServerIdentifier(dbName);
  const user = assertSafeSqlServerIdentifier(login);
  const pwd = escapeSqlStringLiteral(password);
  return [
    `IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'${user}') CREATE LOGIN [${user}] WITH PASSWORD = N'${pwd}', CHECK_POLICY = OFF;`,
    `ALTER LOGIN [${user}] WITH PASSWORD = N'${pwd}';`,
    `USE [${db}]; IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${user}') CREATE USER [${user}] FOR LOGIN [${user}]; ALTER ROLE db_datareader ADD MEMBER [${user}];`,
    `ALTER DATABASE [${db}] SET READ_ONLY WITH ROLLBACK IMMEDIATE;`,
  ];
}

const execFileAsync = promisify(execFile);

export type IsolatedMssqlEnv = {
  host: string;
  saPassword: string;
  port?: number;
};

export function readIsolatedMssqlEnv(): IsolatedMssqlEnv | null {
  const host = process.env.MIGRATION_ISOLATED_MSSQL_HOST?.trim();
  const saPassword = process.env.MIGRATION_ISOLATED_MSSQL_SA_PASSWORD?.trim();
  if (!host || !saPassword) return null;
  if (!/^[\w.-]+(?:,\d+|:\d+)?$/.test(host)) return null;
  const port = Number(process.env.MIGRATION_ISOLATED_MSSQL_PORT ?? '1433');
  return { host, saPassword, port: Number.isFinite(port) ? port : 1433 };
}

/**
 * Runs one query on the isolated restore SQL Server. The sa password goes through
 * SQLCMDPASSWORD and the SQL through a private temp file, so neither (nor a reader-login
 * password inside the SQL) appears in the process list.
 */
export async function runIsolatedSqlcmdQuery(
  env: IsolatedMssqlEnv,
  sql: string,
  timeoutMs: number,
  opts: { headers?: boolean } = {}
): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gates-sqlcmd-'));
  const file = path.join(dir, 'query.sql');
  try {
    await writeFile(file, sql, { encoding: 'utf8', mode: 0o600 });
    const { stdout } = await execFileAsync(
      'sqlcmd',
      [
        '-S',
        env.host,
        '-U',
        'sa',
        ...(opts.headers ? [] : ['-h', '-1']),
        '-s',
        '|',
        '-W',
        '-b',
        '-i',
        file,
      ],
      {
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, SQLCMDPASSWORD: env.saPassword },
      }
    );
    return stdout;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function sqlDiskLiteral(backupPathOnSqlHost: string): string {
  return `N'${escapeSqlStringLiteral(backupPathOnSqlHost)}'`;
}
