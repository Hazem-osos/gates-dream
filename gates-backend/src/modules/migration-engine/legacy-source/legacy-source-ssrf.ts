import dns from 'node:dns/promises';
import net from 'node:net';
import { MigrationTargetSafetyError } from '../target-safety';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  '169.254.169.254',
]);

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
  }
  if (net.isIPv6(ip)) {
    const n = ip.toLowerCase();
    if (n === '::1' || n.startsWith('fe80:') || n.startsWith('fc') || n.startsWith('fd')) return true;
  }
  return false;
}

function allowLocalMigrationSqlHost(): boolean {
  if (process.env.MIGRATION_ALLOW_PRIVATE_SQL_HOSTS === 'true') return true;
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.MIGRATION_ALLOW_LOCAL_SQL_HOST !== 'false';
}

/** True when Host still looks like `server,1433` or `server:1433` (port mixed in). */
export function legacySqlHostLooksCombinedPort(host: string): boolean {
  const h = host.trim();
  if (!h) return false;
  if (h.includes(',') && /^\d+$/.test((h.split(',')[1] ?? '').trim())) return true;
  if (h.includes('\\')) return false;
  const idx = h.lastIndexOf(':');
  if (idx > 0 && /^\d+$/.test(h.slice(idx + 1))) return true;
  return false;
}

export function isLegacySqlDnsFailureMessage(message: string): boolean {
  return /getaddrinfo|enotfound|eservfail|eai_again|could not be resolved/i.test(message);
}

export function legacySqlHostUnresolvedMessage(host: string): string {
  const shown = host.trim() || '—';
  if (legacySqlHostLooksCombinedPort(shown)) {
    return `SQL Server host «${shown}» looks like host,port in one field. Put hostname or IP in Host and the port in Port (not host,1433).`;
  }
  return (
    `SQL Server host «${shown}» could not be resolved from this server. ` +
    `Cloud/Railway cannot see office LAN names. Use a public hostname or IP, the on-premise connector, ` +
    `or restore the .bak on a SQL Server this app can reach.`
  );
}

/**
 * Validates remote SQL host before outbound connect.
 * Private IPs allowed only when MIGRATION_ALLOW_PRIVATE_SQL_HOSTS=true (VPN/on-prem routes).
 * In non-production, localhost/private LAN hosts are allowed for local Legacy SQL pilots.
 */
export async function assertSafeLegacySqlHost(host: string): Promise<void> {
  const raw = host.trim();
  if (legacySqlHostLooksCombinedPort(raw)) {
    throw new MigrationTargetSafetyError(legacySqlHostUnresolvedMessage(raw));
  }
  const h = raw.toLowerCase();
  if (!h || h.length > 253) {
    throw new MigrationTargetSafetyError('Invalid SQL Server host');
  }
  const allowLocal = allowLocalMigrationSqlHost();
  if (BLOCKED_HOSTNAMES.has(h) || h.endsWith('.internal')) {
    if (!(allowLocal && (h === 'localhost' || h === '127.0.0.1'))) {
      throw new MigrationTargetSafetyError('SQL Server host is not allowed');
    }
  }
  if (/railway|metadata/i.test(h)) {
    throw new MigrationTargetSafetyError('SQL Server host appears to be a blocked destination');
  }
  if (/localhost/i.test(h) && !allowLocal) {
    throw new MigrationTargetSafetyError(
      'Localhost SQL requires non-production backend or MIGRATION_ALLOW_PRIVATE_SQL_HOSTS=true'
    );
  }

  let resolved: string;
  if (net.isIP(h)) {
    resolved = h;
  } else {
    try {
      const records = await dns.lookup(h, { verbatim: true });
      resolved = records.address;
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as NodeJS.ErrnoException).code)
          : '';
      if (code === 'ENOTFOUND' || code === 'ESERVFAIL' || code === 'EAI_AGAIN') {
        throw new MigrationTargetSafetyError(legacySqlHostUnresolvedMessage(raw));
      }
      throw new MigrationTargetSafetyError(
        `SQL Server host check failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (isPrivateIp(resolved) && !allowLocal) {
    throw new MigrationTargetSafetyError(
      'Private SQL Server addresses require MIGRATION_ALLOW_PRIVATE_SQL_HOSTS=true (authorized network route)'
    );
  }
}
