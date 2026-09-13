import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../cache/redis';
import { logger } from '../logger';
import { extractSecurityContext } from '../security/security-audit';

/**
 * Distributed Rate Limiting Middleware
 * Uses Redis for distributed rate limiting across multiple instances
 */

export interface DistributedRateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  standardHeaders?: boolean; // Return rate limit info in `RateLimit-*` headers
  legacyHeaders?: boolean; // Return rate limit info in `X-RateLimit-*` headers
  message?: string; // Error message when limit exceeded
}

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_REQUESTS = 100;

/**
 * Generate rate limit key
 */
function generateKey(req: Request, options: DistributedRateLimitOptions): string {
  if (options.keyGenerator) {
    return options.keyGenerator(req);
  }

  const context = extractSecurityContext(req);
  const userId = (req as any).user?.sub;
  const ip = context.ipAddress || req.ip || 'unknown';

  // Use user ID if available, otherwise use IP
  const identifier = userId || ip;
  const path = req.path.replace(/\/\d+/g, '/:id'); // Normalize paths with IDs

  return `rate_limit:${identifier}:${req.method}:${path}`;
}

/**
 * Distributed rate limit middleware factory
 */
export function distributedRateLimit(
  options: Partial<DistributedRateLimitOptions> = {}
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const standardHeaders = options.standardHeaders !== false;
  const legacyHeaders = options.legacyHeaders !== false;
  const message = options.message || 'Too many requests, please try again later';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if Redis not available (fail open)
    if (!redisClient.isReady()) {
      logger.warn('Redis not available for distributed rate limiting, skipping');
      return next();
    }

    try {
      const key = generateKey(req, {
        windowMs,
        maxRequests,
        ...options,
      });
      const redis = redisClient.getClient();
      const windowSeconds = Math.ceil(windowMs / 1000);

      // Use sliding window log algorithm
      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove old entries outside the window
      await redis.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      const count = await redis.zcard(key);

      if (count >= maxRequests) {
        // Rate limit exceeded
        const ttl = await redis.ttl(key);
        const resetTime = now + (ttl > 0 ? ttl * 1000 : windowMs);

        // Set headers
        if (standardHeaders) {
          res.setHeader('RateLimit-Limit', maxRequests.toString());
          res.setHeader('RateLimit-Remaining', '0');
          res.setHeader('RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
        }

        if (legacyHeaders) {
          res.setHeader('X-RateLimit-Limit', maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
        }

        logger.warn(
          {
            key,
            count,
            maxRequests,
            ip: req.ip,
            path: req.path,
            method: req.method,
          },
          'Rate limit exceeded'
        );

        return void res.status(429).json({
          status: 'error',
          message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((resetTime - now) / 1000),
        });
      }

      // Add current request to window
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      await redis.expire(key, windowSeconds);

      // Calculate remaining requests
      const remaining = Math.max(0, maxRequests - count - 1);
      const resetTime = now + windowMs;

      // Set headers
      if (standardHeaders) {
        res.setHeader('RateLimit-Limit', maxRequests.toString());
        res.setHeader('RateLimit-Remaining', remaining.toString());
        res.setHeader('RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
      }

      if (legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
      }

      // Track response status if needed
      if (options.skipSuccessfulRequests || options.skipFailedRequests) {
        const originalJson = res.json.bind(res);
        res.json = function (body: any) {
          const statusCode = res.statusCode;
          const shouldSkip =
            (options.skipSuccessfulRequests && statusCode < 400) ||
            (options.skipFailedRequests && statusCode >= 400);

          if (shouldSkip) {
            // Remove this request from count
            redis.zremrangebyscore(key, now - 1000, now + 1000).catch((err) => {
              logger.error({ err }, 'Failed to remove request from rate limit');
            });
          }

          return originalJson(body);
        };
      }

      next();
    } catch (error) {
      logger.error({ error }, 'Distributed rate limit error');
      // Fail open - don't block requests if rate limiting fails
      next();
    }
  };
}

/**
 * Per-user rate limiter (stricter limits)
 */
export const perUserRateLimit = distributedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // 50 requests per 15 minutes per user
  keyGenerator: (req) => {
    const userId = (req as any).user?.sub || 'anonymous';
    return `rate_limit:user:${userId}`;
  },
});

/**
 * Per-IP rate limiter (for unauthenticated requests)
 */
export const perIPRateLimit = distributedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes per IP
  keyGenerator: (req) => {
    const context = extractSecurityContext(req);
    const ip = context.ipAddress || req.ip || 'unknown';
    return `rate_limit:ip:${ip}`;
  },
});

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictRateLimit = distributedRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
});

