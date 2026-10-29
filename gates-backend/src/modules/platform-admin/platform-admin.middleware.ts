import type { NextFunction, Request, RequestHandler, Response } from 'express';
import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/middleware/error-handler';
import { verifyPlatformAdminToken } from './platform-admin-token';
import { capsForRole, type PlatformCap } from './platform-admin-roles';

export interface PlatformAdminRequest extends Request {
  platformAdmin?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    caps: PlatformCap[];
    twoFactorEnabled: boolean;
  };
}

function bearer(req: Request): string | null {
  const raw = req.headers.authorization;
  if (typeof raw !== 'string') return null;
  const [scheme, token] = raw.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

/**
 * Guards every /api/v1/platform-admin route except login. The admin row is re-read on every
 * request (tiny table), so disabling an admin, changing their role, or bumping their session
 * version (password/2FA change) takes effect immediately.
 */
export async function requirePlatformAdmin(
  req: PlatformAdminRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = bearer(req);
    if (!token) throw new AppError(401, 'سجّل الدخول إلى لوحة الإدارة');
    const payload = verifyPlatformAdminToken(token);
    const admin = await prisma.platformAdmin.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, isActive: true, role: true, sessionVersion: true, totpEnabledAt: true },
    });
    if (!admin || !admin.isActive) throw new AppError(401, 'حساب الإدارة غير مفعّل');
    if (payload.sv !== admin.sessionVersion) {
      throw new AppError(401, 'تم تغيير بيانات الدخول. سجّل الدخول مرة أخرى.', true, 'ADMIN_SESSION_EXPIRED');
    }
    req.platformAdmin = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      caps: capsForRole(admin.role),
      twoFactorEnabled: Boolean(admin.totpEnabledAt),
    };
    next();
  } catch (err) {
    next(err instanceof AppError ? err : new AppError(401, 'غير مصرح'));
  }
}

/** Route guard: the signed-in admin's role must include `cap`. */
export function requireCap(cap: PlatformCap): RequestHandler {
  return (req, _res, next) => {
    const admin = (req as PlatformAdminRequest).platformAdmin;
    if (!admin?.caps.includes(cap)) {
      return next(new AppError(403, 'دورك في لوحة الإدارة لا يسمح بهذه العملية', true, 'ADMIN_FORBIDDEN'));
    }
    next();
  };
}
