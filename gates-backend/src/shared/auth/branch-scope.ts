import { prisma } from '../database/prisma';
import type { AuthRequest } from './types';
import { isAdminRequest } from './roles.util';

/**
 * The branches a user may see, or `null` for "unrestricted".
 *
 * Legacy `UserBranches` (`untlogin.pas` 424-460) builds a `UserBranchesCond`
 * SQL fragment from this table and appends it to every browse query, so the
 * restriction applies to *listings*, not just to the active branch. The web app
 * only ever checked the active branch in middleware, which left a restricted
 * user able to read other branches' rows through any list endpoint that
 * accepted a `branchId` filter or returned all branches by default.
 *
 * `null` (rather than an empty array) distinguishes "no rows, so no
 * restriction" from "restricted to nothing", matching the legacy behavior of an
 * open condition when the table has not been back-filled for a user.
 */
export async function resolvePermittedBranchIds(
  userId: string,
  companyId: string
): Promise<string[] | null> {
  const rows = await prisma.userBranchPermission.findMany({
    where: { userId, companyId },
    select: { branchId: true },
  });
  if (rows.length === 0) return null;
  return rows.map((r) => r.branchId);
}

/** Request-scoped wrapper: Admin and unauthenticated service calls are unrestricted. */
export async function requestPermittedBranchIds(
  req: AuthRequest
): Promise<string[] | null> {
  const companyId = req.companyId ?? req.tenantId;
  const userId = req.user?.sub;
  if (!companyId || !userId || isAdminRequest(req)) return null;
  return resolvePermittedBranchIds(userId, companyId);
}

/**
 * Narrows a `branchId` list filter to what the user may see. Returns the Prisma
 * `where` fragment to spread into a query:
 *
 * - unrestricted user, no filter  -> `{}` (all branches)
 * - unrestricted user, filter     -> `{ branchId: <requested> }`
 * - restricted user, no filter    -> `{ branchId: { in: permitted } }`
 * - restricted user, filter       -> `{ branchId: <requested> }` when permitted,
 *   otherwise `{ branchId: { in: [] } }` so the query returns nothing instead of
 *   silently widening to every branch.
 */
export function branchScopeFilter(
  permitted: string[] | null,
  requestedBranchId?: string | null
): { branchId?: string | { in: string[] } } {
  if (!permitted) {
    return requestedBranchId ? { branchId: requestedBranchId } : {};
  }
  if (requestedBranchId) {
    return permitted.includes(requestedBranchId)
      ? { branchId: requestedBranchId }
      : { branchId: { in: [] } };
  }
  return { branchId: { in: permitted } };
}
