import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth/types';
import { AppError } from './error-handler';
import { isAdminRequest } from '../auth/roles.util';
import { resolvePermittedBranchIds } from '../auth/branch-scope';

/**
 * Rejects a restricted user who explicitly asks for a branch they have no
 * `UserBranchPermission` row for, wherever that branch arrives from: the
 * `branchId` query filter that ~100 list/report endpoints accept, or a
 * `branchId` in a create/update body.
 *
 * Mounted globally so the guard cannot be forgotten on a new endpoint. It is
 * deliberately narrow: it blocks *asking for another branch*, which is the
 * escalation path, but does not by itself narrow an unfiltered listing down to
 * the permitted set — that needs a per-query `branchScopeFilter` (see
 * `shared/auth/branch-scope.ts`) because a Prisma `where` can express
 * `{ in: [...] }` while a single query parameter cannot.
 *
 * Costs nothing for the common cases: it returns immediately when no `branchId`
 * was supplied, and when the caller is an Admin.
 */
export async function enforceBranchScope(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const requested =
      (typeof req.query?.branchId === 'string' ? req.query.branchId : undefined) ??
      (typeof (req.body as { branchId?: unknown } | undefined)?.branchId === 'string'
        ? (req.body as { branchId: string }).branchId
        : undefined);

    if (!requested) return void next();

    const companyId = req.companyId ?? req.tenantId;
    const userId = req.user?.sub;
    if (!companyId || !userId || isAdminRequest(req)) return void next();

    const permitted = await resolvePermittedBranchIds(userId, companyId);
    if (permitted && !permitted.includes(requested)) {
      throw new AppError(403, 'User does not have access to this branch');
    }

    next();
  } catch (err) {
    next(err);
  }
}
