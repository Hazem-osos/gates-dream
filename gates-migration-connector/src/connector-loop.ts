import type sql from 'mssql';
import { gzipSync } from 'node:zlib';
import { handleConnectorOp } from './connector-ops.js';
import { connectLegacySql, parseLegacyAdoUrl } from './mssql-connect.js';

const POLL_MS = Number(process.env.CONNECTOR_POLL_MS ?? '2000');
const MAX_BACKOFF_MS = Number(process.env.CONNECTOR_MAX_BACKOFF_MS ?? '60000');

function readConnectorEnv() {
  const API = process.env.GATES_API_BASE?.replace(/\/$/, '') ?? '';
  const TOKEN = process.env.CONNECTOR_TOKEN ?? '';
  const LEGACY_URL = process.env.LEGACY_MSSQL_URL ?? '';
  return { API, TOKEN, LEGACY_URL };
}

async function connectPool(legacyUrl: string): Promise<sql.ConnectionPool> {
  const fromEnv =
    process.env.LEGACY_MSSQL_SERVER && process.env.LEGACY_MSSQL_DATABASE && process.env.LEGACY_MSSQL_USER
      ? {
          server: process.env.LEGACY_MSSQL_SERVER,
          database: process.env.LEGACY_MSSQL_DATABASE,
          user: process.env.LEGACY_MSSQL_USER,
          password: process.env.LEGACY_MSSQL_PASSWORD ?? '',
        }
      : parseLegacyAdoUrl(legacyUrl);
  if (!fromEnv) {
    throw new Error('SQL Server connection details are incomplete');
  }
  const { pool, used } = await connectLegacySql(fromEnv);
  try {
    await assertConnectedToChosenDatabase(pool, fromEnv.database);
  } catch (err) {
    await pool.close().catch(() => undefined);
    throw new FatalConnectorError(err instanceof Error ? err.message : String(err));
  }
  console.info(`Connected to legacy SQL Server (${used}), database ${fromEnv.database}`);
  return pool;
}

/** Stops the agent instead of retrying: retrying cannot fix it. */
export class FatalConnectorError extends Error {}

/**
 * The pool must be on the database the customer typed (not the login's default database),
 * and the login must not be a server administrator: Gates reads with the least privilege.
 */
export async function assertConnectedToChosenDatabase(pool: sql.ConnectionPool, database: string) {
  const r = await pool
    .request()
    .query<{ db: string; sysadmin: number }>(
      `SELECT DB_NAME() AS db, CAST(IS_SRVROLEMEMBER('sysadmin') AS int) AS sysadmin`
    );
  const row = r.recordset[0];
  if (!row || String(row.db).toLowerCase() !== database.trim().toLowerCase()) {
    throw new Error(
      `Connected to database "${row?.db ?? '?'}" instead of "${database}". Check the database name and that the login can open it.`
    );
  }
  if (Number(row.sysadmin) === 1) {
    throw new Error(
      'This SQL login is a server administrator (sysadmin). Use a read-only login that can open only the Gates database (see WINDOWS_PC.md).'
    );
  }
}

/** Results travel as gzip+hex: plain [0-9a-f] cannot trip the API input filter or be altered by it. */
export function encodeConnectorPayload(value: unknown): string {
  return gzipSync(Buffer.from(JSON.stringify(value ?? null), 'utf8')).toString('hex');
}

async function postComplete(api: string, token: string, body: Record<string, unknown>) {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(`${api}/connector/v1/complete`, {
        method: 'POST',
        headers: { 'X-Connector-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok || res.status === 404) return; // 404: command expired or aborted on the server
      lastStatus = res.status;
      if (await isRevokedResponse(res)) throw new FatalConnectorError(PAIRING_REVOKED);
    } catch (err) {
      if (err instanceof FatalConnectorError) throw err;
    }
    await sleep(1000 * attempt);
  }
  console.error(`Could not send a result to Gates (HTTP ${lastStatus || 'network'}). Gates will retry the step.`);
}

/**
 * The API answers 401 for any failure on these routes (a slow database too). Only its own
 * token messages mean the pairing is really gone; everything else is retried.
 */
async function isRevokedResponse(res: Response): Promise<boolean> {
  if (res.status !== 401 && res.status !== 403) return false;
  const text = await res.text().catch(() => '');
  return /invalid connector token|connector token expired|missing or invalid connector token/i.test(text);
}

/** SQL errors where a fresh connection and one retry of the (read-only) command can succeed. */
export function isTransientSqlError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const code = String(e?.code ?? '');
  const msg = String(e?.message ?? '');
  return (
    ['ELOGIN', 'ESOCKET', 'ECONNCLOSED', 'ETIMEOUT', 'ECONNRESET', 'ENOTOPEN'].includes(code) ||
    /login failed|infrastructure error|connection is closed|connection lost|socket hang up|timeout/i.test(msg)
  );
}

const PAIRING_REVOKED =
  'Gates no longer accepts this agent (pairing revoked or replaced). Create a new pairing code in the wizard and start the agent again.';

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function loop(api: string, token: string, legacyUrl: string) {
  let pool: sql.ConnectionPool | null = null;
  let backoff = POLL_MS;

  for (;;) {
    try {
      if (!pool || !pool.connected) {
        pool = await connectPool(legacyUrl);
        backoff = POLL_MS;
      }

      const res = await fetch(`${api}/connector/v1/poll`, {
        method: 'POST',
        headers: { 'X-Connector-Token': token, 'Content-Type': 'application/json' },
      });
      if (await isRevokedResponse(res)) {
        throw new FatalConnectorError(PAIRING_REVOKED);
      }
      if (!res.ok) {
        throw new Error(`Poll HTTP ${res.status}`);
      }
      const body = (await res.json()) as {
        data?: Array<{ id: string; operation: string; payload: Record<string, unknown> }>;
      };
      for (const cmd of body.data ?? []) {
        let outcome: Record<string, unknown>;
        try {
          let result: Record<string, unknown>;
          try {
            result = await handleConnectorOp(cmd.operation, cmd.payload, pool);
          } catch (first) {
            if (!isTransientSqlError(first)) throw first;
            console.error('SQL connection problem, reconnecting once:', first instanceof Error ? first.message : first);
            await pool.close().catch(() => undefined);
            pool = await connectPool(legacyUrl);
            result = await handleConnectorOp(cmd.operation, cmd.payload, pool);
          }
          outcome = { commandId: cmd.id, ok: true, encoding: 'gzip-hex', resultHex: encodeConnectorPayload(result) };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          outcome = { commandId: cmd.id, ok: false, encoding: 'gzip-hex', errorHex: encodeConnectorPayload(message) };
        }
        await postComplete(api, token, outcome);
      }
      await sleep(POLL_MS);
    } catch (err) {
      if (err instanceof FatalConnectorError) throw err;
      console.error('Connector loop error', err instanceof Error ? err.message : err);
      try {
        await pool?.close();
      } catch {
        /* ignore */
      }
      pool = null;
      await sleep(backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }
  }
}

/** Agent must await this. Do not dynamic-import it in the packed EXE. */
export async function startConnectorLoop(): Promise<never> {
  const { API, TOKEN, LEGACY_URL } = readConnectorEnv();
  if (!API || !TOKEN || !(LEGACY_URL || (process.env.LEGACY_MSSQL_SERVER && process.env.LEGACY_MSSQL_DATABASE))) {
    throw new Error('Set GATES_API_BASE, CONNECTOR_TOKEN, and SQL Server details');
  }
  console.info('Connecting to SQL Server. Keep this window open — Gates sends analyze commands here.');
  await loop(API, TOKEN, LEGACY_URL);
  throw new Error('Connector loop stopped unexpectedly');
}
