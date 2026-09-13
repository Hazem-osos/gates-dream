import type { CorsOptions } from 'cors';
import { env } from './env';

function isDevelopmentLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:') return false;
    const h = u.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
  } catch {
    return false;
  }
}

/**
 * Allowed browser origins: FRONTEND_URL plus optional CORS_ORIGINS (comma-separated).
 */
export function getCorsAllowedOrigins(): string[] {
  const raw = env.CORS_ORIGINS?.trim();
  if (raw) {
    const extra = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const primary = env.FRONTEND_URL;
    return Array.from(new Set([primary, ...extra]));
  }
  return [env.FRONTEND_URL];
}

export function buildCorsOptions(): CorsOptions {
  const origins = getCorsAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (origins.includes(origin)) {
        callback(null, true);
        return;
      }
      const allowRailway = ['true', '1', 'yes', 'on'].includes(
        (process.env.CORS_ALLOW_RAILWAY ?? '').trim().toLowerCase()
      );
      if (allowRailway) {
        try {
          const host = new URL(origin).hostname;
          if (host.endsWith('.up.railway.app') || host.endsWith('.railway.app')) {
            callback(null, true);
            return;
          }
        } catch {
          /* ignore */
        }
      }
      // Dev: allow localhost / 127.0.0.1 on any port so `localhost` vs `127.0.0.1` still works
      if (env.NODE_ENV === 'development' && isDevelopmentLoopbackOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'If-None-Match',
      'X-Tenant-ID',
      'X-Tenant-Id',
      'X-Company-ID',
      'X-Company-Id',
      'X-Branch-ID',
      'X-Branch-Id',
      'X-Fiscal-Year-ID',
      'X-Fiscal-Year-Id',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['ETag', 'X-Cache'],
  };
}
