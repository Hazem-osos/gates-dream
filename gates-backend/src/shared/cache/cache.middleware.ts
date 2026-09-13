import { Request, Response, NextFunction } from 'express';
import { redisClient } from './redis';
import { logger } from '../logger';
import { metricsCollector } from '../monitoring/metrics';
import type { AuthRequest } from '../auth/types';
import { buildHttpCacheKey, shouldCacheHttpGet } from './cache-key.util';

/**
 * Caching Middleware
 * Caches GET request responses in Redis
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean; // Whether to cache this request
  tags?: string[]; // Cache tags for invalidation
}

// Cache warming configuration
const CACHE_WARMING_ENABLED = process.env.CACHE_WARMING_ENABLED === 'true';
const CACHE_WARMING_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate cache key from request (tenant + user scoped)
 */
export const tenantAwareKeyGenerator = (req: Request): string =>
  buildHttpCacheKey(req as AuthRequest);

const defaultKeyGenerator = tenantAwareKeyGenerator;

/**
 * Cache middleware factory
 */
export const cache = (options: CacheOptions = {}) => {
  const ttl = options.ttl || 300; // Default 5 minutes
  const keyGenerator = options.keyGenerator || defaultKeyGenerator;
  const userCondition = options.condition || (() => true);

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    if (!shouldCacheHttpGet(req as AuthRequest)) {
      return next();
    }

    // Check condition
    if (!userCondition(req)) {
      return next();
    }

    // Check if Redis is available
    if (!redisClient.isReady()) {
      return next();
    }

    try {
      const cacheKey = keyGenerator(req);
      const redis = redisClient.getClient();

      // Try to get from cache
      const cached = await redis.get(cacheKey);

      if (cached) {
        logger.debug({ cacheKey, url: req.url }, 'Cache hit');
        metricsCollector.recordCacheHit();
        res.setHeader('X-Cache', 'HIT');
        return void res.json(JSON.parse(cached));
      }

      // Cache miss - intercept response
      logger.debug({ cacheKey, url: req.url }, 'Cache miss');
      metricsCollector.recordCacheMiss();

      const originalJson = res.json.bind(res);
      res.json = function (body: any): Response {
        // Store in cache
        if (res.statusCode === 200 && body) {
          redis.setex(cacheKey, ttl, JSON.stringify(body)).catch((err) => {
            logger.error({ err, cacheKey }, 'Error caching response');
          });
        }
        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error({ error }, 'Cache middleware error');
      next();
    }
  };
};

/**
 * Cache invalidation helper
 */
export const invalidateCache = async (pattern: string): Promise<void> => {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    const keys = await redis.keys(`cache:v2:*${pattern}*`);
    if (keys.length === 0) {
      const legacy = await redis.keys(`cache:${pattern}*`);
      if (legacy.length > 0) await redis.del(...legacy);
    }
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug({ pattern, keysCount: keys.length }, 'Cache invalidated');
    }
  } catch (error) {
    logger.error({ error, pattern }, 'Error invalidating cache');
  }
};
