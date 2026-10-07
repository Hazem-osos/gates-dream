import { Response, NextFunction } from 'express';
import { AuthRequest, Permission, PermissionAction } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  getCachedUserPermissions,
  permissionGrantedFromCache,
} from '../../../shared/cache/tenant-context.cache';

export type LeaveCapability =
  | 'view'
  | 'request'
  | 'manage'
  | 'approve'
  | 'adjust'
  | 'policy_manage'
  | 'ledger_view';

const ALIASES: Record<LeaveCapability, PermissionAction[]> = {
  view: ['view'],
  request: ['request', 'edit', 'manage'],
  manage: ['manage', 'edit'],
  approve: ['approve', 'manage'],
  adjust: ['adjust', 'manage', 'edit'],
  policy_manage: ['policy_manage', 'manage', 'edit'],
  ledger_view: ['ledger_view', 'view', 'manage'],
};

async function hasLeaveCapability(
  userId: string,
  companyId: string,
  capability: LeaveCapability
): Promise<boolean> {
  const cached = await getCachedUserPermissions(userId, companyId);
  for (const action of ALIASES[capability]) {
    if (permissionGrantedFromCache(cached, 'leave', action as Permission['action'])) {
      return true;
    }
  }
  return false;
}

export function authorizeLeave(capability: LeaveCapability) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.sub;
    const companyId = req.companyId ?? req.tenantId;
    if (!userId || !companyId) {
      return next(new AppError(401, 'Unauthorized'));
    }
    const ok = await hasLeaveCapability(userId, companyId, capability);
    if (!ok) return next(new AppError(403, 'Forbidden'));
    return next();
  };
}
