import * as crypto from 'crypto';
import type { AuthRequest } from '../auth/types';

/**
 * Builds a Redis HTTP cache key scoped to tenant + user + fiscal context.
 * Exported for unit tests (tenant isolation).
 */
export function buildHttpCacheKey(req: AuthRequest): string {
  const auth = req as AuthRequest;
  const userId = auth.user?.sub ?? 'anon';
  const companyId =
    auth.companyId ?? auth.tenantId ?? auth.user?.company_id ?? auth.user?.tenant_id ?? 'no-company';
  const branchId = auth.branchId ?? auth.user?.branch_id ?? '';
  const fiscalYearId = auth.fiscalYearId ?? req.headers['x-fiscal-year-id']?.toString() ?? '';
  const authHeader = req.headers.authorization?.toString() ?? '';
  const authFingerprint = authHeader
    ? crypto.createHash('sha256').update(authHeader).digest('hex').slice(0, 16)
    : 'no-auth';

  const queryString = JSON.stringify(req.query ?? {});
  const raw = [
    companyId,
    userId,
    branchId,
    fiscalYearId,
    authFingerprint,
    req.method,
    req.originalUrl ?? req.url,
    queryString,
  ].join('|');

  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return `cache:v2:${hash}`;
}

/** Skip caching for profile and other user-private GET endpoints. */
export function shouldCacheHttpGet(req: AuthRequest): boolean {
  if (req.method !== 'GET') return false;
  const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
  if (path.includes('/users/me')) return false;
  if (path.includes('/notifications')) return false;
  return true;
}
