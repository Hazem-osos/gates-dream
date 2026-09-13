import { requestPermittedBranchIds } from '../../../shared/auth/branch-scope';
import type { AuthRequest } from '../../../shared/auth/types';
import { getCachedUserPermissions } from '../../../shared/cache/tenant-context.cache';
import { AppError } from '../../../shared/middleware/error-handler';
import { extractJwtRoles } from '../tools/ai-tool-access';
import type { SecurityContext } from '../tools/types';

export function permissionsFromCache(
  grantAll: boolean,
  rows: Array<{ resource: string; action: string; allow?: boolean }>
): string[] {
  if (grantAll) return ['*'];
  const granted = rows
    .filter((row) => row.allow !== false)
    .map((row) => `${row.resource}:${row.action}`);
  return [...new Set(granted)];
}

export async function buildSecurityContext(req: AuthRequest): Promise<SecurityContext> {
  const userId = req.user?.sub;
  const companyId = req.companyId ?? req.tenantId;
  if (!userId) throw new AppError(401, 'Authentication required');
  if (!companyId) throw new AppError(400, 'Company ID is required');

  const cached = await getCachedUserPermissions(userId, companyId);
  const permissions = permissionsFromCache(cached.grantAll, cached.permissions);
  const roles = extractJwtRoles(req.user ?? {});
  if (roles.some((role) => role.toLowerCase() === 'admin') && !permissions.includes('*')) {
    permissions.push('*');
  }

  const permitted = await requestPermittedBranchIds(req);

  return {
    userId,
    companyId,
    branchId: req.branchId,
    fiscalYearId: req.fiscalYearId,
    permissions,
    roles,
    role: req.user?.role ?? roles[0],
    permittedBranchIds: permitted ?? undefined,
  };
}
