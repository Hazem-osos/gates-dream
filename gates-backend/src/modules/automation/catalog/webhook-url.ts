import { AppError } from '../../../shared/middleware/error-handler';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.',
  '0.0.0.0',
  '::',
  '::1',
  '[::1]',
  'metadata.google.internal',
  'metadata.google.internal.',
]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOSTS.has(`${host}.`)) return true;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host.includes(':') && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'))) {
    return true;
  }
  return isPrivateIpv4(host);
}

/**
 * Rule-save SSRF guard for webhook URLs. n8n executes the HTTP call; GATES
 * only rejects obviously-unsafe destinations before the rule is stored.
 */
export function assertSafeWebhookUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppError(400, 'Webhook url must be a valid absolute URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(400, 'Webhook url must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new AppError(400, 'Webhook url must not include credentials');
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new AppError(400, 'Webhook url must not target a private or loopback host');
  }
}
