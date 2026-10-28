import { timingSafeEqual } from 'node:crypto';

/**
 * Security: `/metrics` and `/health` need no login. These helpers decide what an
 * anonymous caller may see in production.
 */

/**
 * `/metrics` exposes request paths, timings and memory. In production it is served only to
 * a caller presenting `Authorization: Bearer <METRICS_TOKEN>`; with no token configured it
 * is not served at all. Outside production it stays open for local Prometheus.
 */
export function metricsAccessAllowed(
  authorization: string | undefined,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.NODE_ENV !== 'production') return true;
  const expected = env.METRICS_TOKEN?.trim();
  if (!expected) return false;
  const presented = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type DependencyLike = { status: string; responseTime?: number };
type HealthLike = {
  status: string;
  timestamp: string;
  checks: { [name: string]: DependencyLike | undefined };
};
export type PublicHealth = {
  status: string;
  timestamp: string;
  checks: Record<string, DependencyLike>;
};

/**
 * In production the public `/health` keeps only each dependency's status and timing.
 * Error text is dropped: a database error can name the internal host, port and user.
 */
export function publicHealthView<T extends HealthLike>(health: T, isProduction: boolean): T | PublicHealth {
  if (!isProduction) return health;
  const checks: PublicHealth['checks'] = {};
  for (const [name, check] of Object.entries(health.checks)) {
    if (!check) continue;
    checks[name] = {
      status: check.status,
      ...(typeof check.responseTime === 'number' ? { responseTime: check.responseTime } : {}),
    };
  }
  return { status: health.status, timestamp: health.timestamp, checks };
}
