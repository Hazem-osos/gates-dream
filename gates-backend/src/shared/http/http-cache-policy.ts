/** Browser must revalidate; do not store as a shared public cache. */
export const MASTER_DATA_CACHE_CONTROL = 'private, must-revalidate';

/** Transactional lists/documents: always revalidate with the origin. */
export const TRANSACTIONAL_CACHE_CONTROL = 'private, no-cache';

export const AUTH_CACHE_CONTROL = 'private, no-store, no-cache, must-revalidate';

const MASTER_OR_REPORT_PATTERNS: RegExp[] = [
  /^\/api\/v1\/accounting\/accounts(\/|$)/,
  /^\/api\/v1\/accounting\/chart-of-accounts(\/|$)/,
  /^\/api\/v1\/accounting\/currencies(\/|$)/,
  /^\/api\/v1\/accounting\/customers(\/|$)/,
  /^\/api\/v1\/accounting\/suppliers(\/|$)/,
  /^\/api\/v1\/accounting\/cost-centers(\/|$)/,
  /^\/api\/v1\/inventory\/items(\/|$)/,
  /^\/api\/v1\/inventory\/warehouses(\/|$)/,
  /^\/api\/v1\/inventory\/units(\/|$)/,
  /^\/api\/v1\/company\/branches(\/|$)/,
  /^\/api\/v1\/settings\/branches(\/|$)/,
  /^\/api\/v1\/companies\/[^/]+\/branches(\/|$)/,
  /^\/api\/v1\/companies\/[^/]+\/settings(\/|$)/,
  /^\/api\/v1\/company-settings(\/|$)/,
  /^\/api\/v1\/accounting\/settings(\/|$)/,
  /^\/api\/v1\/permissions(\/|$)/,
  /^\/api\/v1\/rbac\/permissions(\/|$)/,
  /^\/api\/v1\/users\/permissions(\/|$)/,
  /^\/api\/v1\/roles(\/|$)/,
  /^\/api\/v1\/settings(\/|$)/,
  /\/reports(\/|$)/,
  /\/account-reports(\/|$)/,
];

export function isMasterOrReportPath(path: string): boolean {
  return MASTER_OR_REPORT_PATTERNS.some((re) => re.test(path));
}

/** Cache-Control for GET/HEAD JSON APIs. Auth stays no-store. */
export function cacheControlForPath(path: string): string | null {
  if (path.startsWith('/health')) return null;
  if (path.startsWith('/api/v1/auth')) return AUTH_CACHE_CONTROL;
  if (!path.startsWith('/api/v1')) return null;
  if (isMasterOrReportPath(path)) return MASTER_DATA_CACHE_CONTROL;
  return TRANSACTIONAL_CACHE_CONTROL;
}
