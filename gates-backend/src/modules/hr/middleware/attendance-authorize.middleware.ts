import { Response, NextFunction } from 'express';
import { AuthRequest, Permission, PermissionAction } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  getCachedUserPermissions,
  permissionGrantedFromCache,
} from '../../../shared/cache/tenant-context.cache';

export type AttendanceCapability =
  | 'view'
  | 'manage'
  | 'correct'
  | 'approve'
  | 'lock'
  | 'device_manage';

const ALIASES: Record<AttendanceCapability, PermissionAction[]> = {
  view: ['view'],
  manage: ['manage', 'edit'],
  correct: ['correct', 'edit', 'manage'],
  approve: ['approve'],
  lock: ['lock', 'approve'],
  device_manage: ['device_manage', 'edit', 'manage'],
};

async function hasAttendanceCapability(
  userId: string,
  companyId: string,
  capability: AttendanceCapability
): Promise<boolean> {
  const cached = await getCachedUserPermissions(userId, companyId);
  for (const action of ALIASES[capability]) {
    if (permissionGrantedFromCache(cached, 'attendance', action as Permission['action'])) {
      return true;
    }
  }
  return false;
}

export function authorizeAttendance(capability: AttendanceCapability) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.sub;
    const companyId = req.companyId ?? req.tenantId;
    if (!userId || !companyId) {
      return next(new AppError(401, 'Unauthorized'));
    }
    const ok = await hasAttendanceCapability(userId, companyId, capability);
    if (!ok) return next(new AppError(403, 'Forbidden'));
    return next();
  };
}
