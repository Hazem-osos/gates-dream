import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowMinutes: number;
}

export function rateLimitMiddleware(prisma: PrismaClient, config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.sessionCtx) {
      return void res.status(401).json({ error: 'Session context required' });
    }

    const { tenantId, userId } = req.sessionCtx;
    const windowStart = new Date();
    windowStart.setMinutes(Math.floor(windowStart.getMinutes() / config.windowMinutes) * config.windowMinutes);
    windowStart.setSeconds(0);
    windowStart.setMilliseconds(0);

    try {
      // MySQL-compatible rate limiting using RateLimit table
      // Check if rate limit record exists and is within limit
      const existing = await prisma.rateLimit.findUnique({
        where: {
          tenantId_userId_key_window: {
            tenantId,
            userId: userId || '',
            key: config.key,
            window: windowStart,
          },
        },
      });

      if (existing && existing.count >= config.limit) {
        return void res.status(429).json({ error: 'Rate limit exceeded' });
      }

      // Update or create rate limit record
      await prisma.rateLimit.upsert({
        where: {
          tenantId_userId_key_window: {
            tenantId,
            userId: userId || '',
            key: config.key,
            window: windowStart,
          },
        },
        create: {
          tenantId,
          userId: userId || null,
          key: config.key,
          window: windowStart,
          count: 1,
        },
        update: {
          count: { increment: 1 },
        },
      });

      next();
    } catch (err) {
      console.error('Rate limit check failed:', err);
      return void res.status(500).json({ error: 'Rate limit check failed' });
    }
  };
}

