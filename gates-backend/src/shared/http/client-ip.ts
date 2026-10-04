import type { Request } from 'express';

const PRIVATE_IP =
  /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.|::ffff:172\.)/i;

function firstHeaderValue(req: Request, name: string): string {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value || '').trim();
}

function firstForwardedIp(req: Request): string {
  return firstHeaderValue(req, 'x-forwarded-for').split(',')[0]?.trim() || '';
}

export function isPrivateOrLocalIp(ip: string): boolean {
  const trimmed = ip.trim();
  if (!trimmed || trimmed === 'unknown' || trimmed === '::') return true;
  return PRIVATE_IP.test(trimmed);
}

/**
 * Real browser IP on Railway (x-real-ip / first x-forwarded-for).
 * `req.ip` is often the shared Next.js / edge hop — never block that alone.
 */
export function resolveClientIp(req: Request): { ip: string; sharedProxy: boolean } {
  const real = firstHeaderValue(req, 'x-real-ip');
  if (real && !isPrivateOrLocalIp(real)) {
    return { ip: real, sharedProxy: false };
  }

  const forwarded = firstForwardedIp(req);
  if (forwarded && !isPrivateOrLocalIp(forwarded)) {
    return { ip: forwarded, sharedProxy: false };
  }

  const fallback = req.ip || req.socket.remoteAddress || 'unknown';
  return { ip: fallback, sharedProxy: true };
}

export function clientIpKey(req: Request): string {
  return resolveClientIp(req).ip;
}
