import sql from 'mssql';

export type LegacySqlConnectInput = {
  server: string;
  database: string;
  user: string;
  password: string;
};

export type LegacySqlConnectAttempt = {
  encrypt: boolean;
  tdsVersion?: string;
  label: string;
};

/** Local / older SQL first. Encrypt=true is retried if the instance actually speaks TLS. */
export const LEGACY_SQL_CONNECT_ATTEMPTS: LegacySqlConnectAttempt[] = [
  { encrypt: false, label: 'encrypt=false' },
  { encrypt: true, label: 'encrypt=true trust-cert' },
  { encrypt: false, tdsVersion: '7_4', label: 'tds 7.4 encrypt=false' },
  { encrypt: false, tdsVersion: '7_3', label: 'tds 7.3 encrypt=false' },
  { encrypt: false, tdsVersion: '7_2', label: 'tds 7.2 encrypt=false (SQL 2008)' },
];

export function parseLegacyServer(raw: string): { server: string; port?: number; instanceName?: string } {
  const s = raw.trim();
  if (!s) throw new Error('SQL Server address is empty');
  const slash = s.split('\\');
  if (slash.length === 2) {
    return { server: slash[0] || 'localhost', instanceName: slash[1] };
  }
  const comma = s.split(',');
  if (comma.length === 2 && /^\d+$/.test(comma[1].trim())) {
    return { server: comma[0].trim(), port: Number(comma[1].trim()) };
  }
  const colon = s.split(':');
  if (colon.length === 2 && /^\d+$/.test(colon[1].trim())) {
    return { server: colon[0].trim(), port: Number(colon[1].trim()) };
  }
  return { server: s };
}

export function parseLegacyAdoUrl(url: string): LegacySqlConnectInput | null {
  const parts = url.split(';').map((p) => p.trim()).filter(Boolean);
  const map = new Map<string, string>();
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    map.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1));
  }
  const server = map.get('server') ?? map.get('data source');
  const database = map.get('database') ?? map.get('initial catalog');
  const user = map.get('user id') ?? map.get('uid');
  const password = map.get('password') ?? map.get('pwd');
  if (!server || !database || !user || password == null) return null;
  return { server, database, user, password };
}

export async function connectLegacySql(input: LegacySqlConnectInput): Promise<{ pool: sql.ConnectionPool; used: string }> {
  const parsed = parseLegacyServer(input.server);
  let lastErr: Error | null = null;
  for (const attempt of LEGACY_SQL_CONNECT_ATTEMPTS) {
    const pool = new sql.ConnectionPool({
      server: parsed.server,
      port: parsed.port,
      database: input.database,
      user: input.user,
      password: input.password,
      // mssql defaults to 15 s per request; large legacy reads take longer. Stay under the
      // backend's 120 s command deadline so a slow read fails here, with a message.
      requestTimeout: Number(process.env.CONNECTOR_SQL_REQUEST_TIMEOUT_MS ?? '110000'),
      connectionTimeout: 30_000,
      options: {
        encrypt: attempt.encrypt,
        trustServerCertificate: true,
        enableArithAbort: true,
        instanceName: parsed.instanceName,
        ...(attempt.tdsVersion ? { tdsVersion: attempt.tdsVersion } : {}),
      },
    } as sql.config);
    try {
      await pool.connect();
      return { pool, used: attempt.label };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      try {
        await pool.close();
      } catch {
        /* ignore */
      }
    }
  }
  throw lastErr ?? new Error('Could not connect to SQL Server');
}
