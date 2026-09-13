import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

export function subscriptionGateMiddleware(prisma: PrismaClient, moduleCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.sessionCtx) {
      return void res.status(401).json({ error: 'Session context required' });
    }

    const { tenantId } = req.sessionCtx;

    try {
      // Subscription billing model is optional; not present on all Prisma schemas
      const subscription = await (prisma as any).subscription.findFirst({
        where: {
          tenantId,
          status: 'active',
          currentPeriodEnd: { gt: new Date() },
          items: {
            some: {
              moduleCode,
              enabled: true,
            },
          },
        },
        include: {
          items: {
            where: {
              moduleCode,
              enabled: true,
            },
          },
        },
      });

      if (!subscription) {
        return void res.status(403).json({
          error: 'Module access denied',
          message: `Module ${moduleCode} requires an active subscription`,
        });
      }

      next();
    } catch (err) {
      console.error('Subscription check failed:', err);
      return void res.status(500).json({ error: 'Subscription check failed' });
    }
  };
}

