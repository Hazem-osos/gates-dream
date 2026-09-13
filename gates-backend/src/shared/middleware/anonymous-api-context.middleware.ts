import { NextFunction, RequestHandler, Response } from 'express';
import type { AuthRequest } from '../auth/types';
import type { JwtPayload } from '../auth/types';
import { prisma } from '../database/prisma';
import { AppError } from './error-handler';
import { logger } from '../logger';

/**
 * Development / open mode: attach a synthetic admin user and first active company
 * so `/api/v1` works without JWT. Replaced `authenticate` when API auth is disabled.
 */
export const anonymousApiContext: RequestHandler = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return next(
        new AppError(500, 'Anonymous API context is disabled in production; authenticate instead')
      );
    }

    const company = await prisma.company.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!company) {
      return next(
        new AppError(503, 'No active company in database; run seed before using anonymous API mode')
      );
    }

    const user = await prisma.user.findFirst({
      where: { companyId: company.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, username: true },
    });

    const branch = await prisma.branch.findFirst({
      where: { companyId: company.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    const sub = user?.id ?? '00000000-0000-0000-0000-000000000001';
    const payload: JwtPayload = {
      sub,
      email: user?.email ?? 'anonymous@local',
      username: user?.username ?? 'anonymous',
      company_id: company.id,
      tenant_id: company.id,
      role: 'admin',
      realm_access: { roles: ['admin'] },
    };

    req.user = payload;
    req.companyId = company.id;
    req.tenantId = company.id;
    if (branch) req.branchId = branch.id;

    logger.debug(
      { companyId: company.id, userId: sub, branchId: req.branchId },
      'Anonymous API context (auth disabled)'
    );

    next();
  } catch (err) {
    next(err instanceof Error ? err : new AppError(500, 'Failed to resolve anonymous API context'));
  }
};
