import type { NextFunction, Request, Response } from 'express';
import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/middleware/error-handler';
import { verifyPlatformAdminToken } from './platform-admin-token';

export interface PlatformAdminRequest extends Request {
  platformAdmin?: { id: string; email: string; name: string | null };
}

function bearer(req: Request): string | null {
  const raw = req.headers.authorization;
  if (typeof raw !== 'string') return null;
  const [scheme, token] = raw.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

/**
 * Guards every /api/v1/platform-admin route except login. The admin row is re-read on every
 * request (tiny table), so disabling an admin cuts their access immediately.
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
      select: { id: true, email: true, name: true, isActive: true },
    });
    if (!admin || !admin.isActive) throw new AppError(401, 'حساب الإدارة غير مفعّل');
    req.platformAdmin = { id: admin.id, email: admin.email, name: admin.name };
    next();
  } catch (err) {
    next(err instanceof AppError ? err : new AppError(401, 'غير مصرح'));
  }
}
