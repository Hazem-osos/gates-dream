/** Best-effort parse for ADO/sqlcmd-style SQL Server connection strings (UI paste helper). */
export type ParsedMssqlConnection = {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
};

/** Split `host,1433` / `host:1433` so Host and Port stay in separate fields. */
export function normalizeSqlHostPort(host: string, port: string): { host: string; port: string } {
  let h = host.trim();
  let p = port.trim() || '1433';
  if (h.includes(',')) {
    const [a, b] = h.split(',', 2);
    h = a.trim();
    if ((b ?? '').trim()) p = b.trim();
  } else if (h.includes(':') && !h.includes('\\')) {
    const idx = h.lastIndexOf(':');
    const maybePort = h.slice(idx + 1);
    if (/^\d+$/.test(maybePort)) {
      p = maybePort;
      h = h.slice(0, idx).trim();
    }
  }
  return { host: h, port: p };
}

function pick(parts: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = parts[k.toLowerCase()];
    if (v) return v;
  }
  return '';
}

export function parseMssqlConnectionString(raw: string): ParsedMssqlConnection | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parts: Record<string, string> = {};
  for (const segment of trimmed.split(';')) {
    const eq = segment.indexOf('=');
    if (eq <= 0) continue;
    const key = segment.slice(0, eq).trim().toLowerCase();
    const value = segment.slice(eq + 1).trim();
    if (key) parts[key] = value;
  }

  let host = pick(parts, ['server', 'data source', 'address', 'addr', 'network address']);
  let port = '1433';
  if (host.includes(',')) {
    const [h, p] = host.split(',');
    host = h.trim();
    port = p.trim() || port;
  }
  if (host.includes(':') && !host.includes('\\')) {
    const [h, p] = host.split(':');
    host = h.trim();
    port = p.trim() || port;
  }

  const database = pick(parts, ['database', 'initial catalog']);
  const user = pick(parts, ['user id', 'uid', 'user']);
  const password = pick(parts, ['password', 'pwd']);

  if (!host || !database || !user) return null;
  return { host, port, database, user, password };
}
