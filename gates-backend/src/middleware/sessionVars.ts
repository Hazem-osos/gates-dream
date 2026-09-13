import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface SessionContext {
  tenantId: string;
  userId: string;
  requestId: string;
  ip?: string;
  userAgent?: string;
}

declare global {
  namespace Express {
    interface Request {
      sessionCtx?: SessionContext;
    }
  }
}

export function sessionVarsMiddleware(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    const requestId = uuidv4();
    const ip = req.ip || req.headers['x-forwarded-for'] as string || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!tenantId || !userId) {
      return void res.status(401).json({ error: 'Missing tenant or user context' });
    }

    req.sessionCtx = { tenantId, userId, requestId, ip, userAgent };

    // Note: MySQL doesn't support session variables like PostgreSQL
    // Session context is stored in request object for application-level use
    // All queries must explicitly filter by tenantId/userId
    // This middleware is kept for compatibility but doesn't set database session vars

    next();
  };
}

