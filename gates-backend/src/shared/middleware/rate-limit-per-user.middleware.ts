import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../cache/redis';
import { logger } from '../logger';
import { env } from '../config/env';

/**
 * Per-User/Tenant Rate Limiting Middleware
 * Provides fine-grained rate limiting based on user and tenant
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

/**
 * Create rate limit middleware
 */
export function createRateLimitMiddleware(config: Partial<RateLimitConfig> = {}) {
  const opts = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if Redis is not available
    if (!env.REDIS_ENABLED || !redisClient.isReady()) {
      return next();
    }

    try {
      // Generate rate limit key
      const keyGenerator = opts.keyGenerator || ((req: Request) => {
        const userId = (req as any).user?.sub || 'anonymous';
        const tenantId = (req as any).tenantId || 'no-tenant';
        const endpoint = req.path;
        return `rate_limit:${tenantId}:${userId}:${endpoint}`;
      });

      const key = keyGenerator(req);
      const client = redisClient.getClient();

      // Get current count
      const current = await client.get(key);
      const count = current ? parseInt(current, 10) : 0;

      // Check if limit exceeded
      if (count >= opts.maxRequests) {
        logger.warn(
          {
            key,
            count,
            maxRequests: opts.maxRequests,
            userId: (req as any).user?.sub,
            tenantId: (req as any).tenantId,
          },
          'Rate limit exceeded'
        );

        res.setHeader('Retry-After', Math.ceil(opts.windowMs / 1000));
        return void res.status(429).json({
          status: 'error',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil(opts.windowMs / 1000),
        });
      }

      // Increment counter
      const multi = client.multi();
      multi.incr(key);
      multi.expire(key, Math.ceil(opts.windowMs / 1000));
      await multi.exec();

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', opts.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, opts.maxRequests - count - 1).toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + opts.windowMs).toISOString());

      next();
    } catch (error) {
      logger.error({ error }, 'Rate limit check failed');
      // On error, allow request through
      next();
    }
  };
}

/**
 * Per-user rate limiter (100 requests per 15 minutes)
 */
export const perUserRateLimiter = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
});

/**
 * Per-tenant rate limiter (1000 requests per hour)
 */
export const perTenantRateLimiter = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,
  maxRequests: 1000,
  keyGenerator: (req: Request) => {
    const tenantId = (req as any).tenantId || 'no-tenant';
    return `rate_limit:tenant:${tenantId}`;
  },
});

