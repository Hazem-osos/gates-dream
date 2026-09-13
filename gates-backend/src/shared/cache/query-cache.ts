import { redisClient } from './redis';
import { logger } from '../logger';
import * as crypto from 'crypto';

/**
 * Database Query Result Caching
 * Caches expensive database query results in Redis
 */

export interface QueryCacheOptions {
  ttl?: number; // Time to live in seconds (default: 300 = 5 minutes)
  keyPrefix?: string; // Cache key prefix (default: 'query:')
  enabled?: boolean; // Enable/disable caching (default: true)
  tags?: string[]; // Cache tags for invalidation
}

const DEFAULT_TTL = 300; // 5 minutes
const DEFAULT_KEY_PREFIX = 'query:';

/**
 * Generate cache key from query and parameters
 */
function generateCacheKey(
  query: string,
  params: any[],
  options: QueryCacheOptions = {}
): string {
  const prefix = options.keyPrefix || DEFAULT_KEY_PREFIX;
  const queryString = JSON.stringify({ query, params });
  const hash = crypto.createHash('sha256').update(queryString).digest('hex');
  return `${prefix}${hash}`;
}

/**
 * Cache query result
 */
export async function cacheQueryResult<T>(
  query: string,
  params: any[],
  result: T,
  options: QueryCacheOptions = {}
): Promise<void> {
  if (!options.enabled !== false && redisClient.isReady()) {
    try {
      const cacheKey = generateCacheKey(query, params, options);
      const ttl = options.ttl || DEFAULT_TTL;
      const redis = redisClient.getClient();

      const cacheData = {
        result,
        cachedAt: new Date().toISOString(),
        tags: options.tags || [],
      };

      await redis.setex(cacheKey, ttl, JSON.stringify(cacheData));

      // Store tags for invalidation
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await redis.sadd(`query:tag:${tag}`, cacheKey);
          await redis.expire(`query:tag:${tag}`, ttl);
        }
      }

      logger.debug(
        {
          cacheKey,
          ttl,
          tags: options.tags,
        },
        'Query result cached'
      );
    } catch (error) {
      logger.error({ error, query }, 'Failed to cache query result');
    }
  }
}

/**
 * Get cached query result
 */
export async function getCachedQueryResult<T>(
  query: string,
  params: any[],
  options: QueryCacheOptions = {}
): Promise<T | null> {
  if (!options.enabled !== false && redisClient.isReady()) {
    try {
      const cacheKey = generateCacheKey(query, params, options);
      const redis = redisClient.getClient();
      const cached = await redis.get(cacheKey);

      if (cached) {
        const cacheData = JSON.parse(cached);
        logger.debug({ cacheKey }, 'Query cache hit');
        return cacheData.result as T;
      }

      logger.debug({ cacheKey }, 'Query cache miss');
    } catch (error) {
      logger.error({ error, query }, 'Failed to get cached query result');
    }
  }

  return null;
}

/**
 * Invalidate cache by key pattern
 */
export async function invalidateQueryCache(pattern: string): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    const keys = await redis.keys(`query:${pattern}*`);

    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug({ pattern, count: keys.length }, 'Query cache invalidated');
    }
  } catch (error) {
    logger.error({ error, pattern }, 'Failed to invalidate query cache');
  }
}

/**
 * Invalidate cache by tags
 */
export async function invalidateQueryCacheByTags(tags: string[]): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    const keysToDelete: string[] = [];

    for (const tag of tags) {
      const tagKey = `query:tag:${tag}`;
      const keys = await redis.smembers(tagKey);
      keysToDelete.push(...keys, tagKey);
    }

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      logger.debug({ tags, count: keysToDelete.length }, 'Query cache invalidated by tags');
    }
  } catch (error) {
    logger.error({ error, tags }, 'Failed to invalidate query cache by tags');
  }
}

/**
 * Clear all query cache (use with caution)
 */
export async function clearAllQueryCache(): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    const redis = redisClient.getClient();
    const keys = await redis.keys('query:*');

    if (keys.length > 0) {
      await redis.del(...keys);
      logger.warn({ count: keys.length }, 'All query cache cleared');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to clear all query cache');
  }
}

/**
 * Query cache decorator for Prisma queries
 * Usage: const result = await cacheQuery(() => prisma.user.findMany(), { ttl: 600 });
 */
export async function cacheQuery<T>(
  queryFn: () => Promise<T>,
  options: QueryCacheOptions & { cacheKey?: string } = {}
): Promise<T> {
  const cacheKey = options.cacheKey || `query:${crypto.randomUUID()}`;

  // Try to get from cache
  if (options.enabled !== false && redisClient.isReady()) {
    try {
      const redis = redisClient.getClient();
      const cached = await redis.get(cacheKey);

      if (cached) {
        const cacheData = JSON.parse(cached);
        logger.debug({ cacheKey }, 'Query cache hit (decorator)');
        return cacheData.result as T;
      }
    } catch (error) {
      logger.error({ error, cacheKey }, 'Failed to get cached query');
    }
  }

  // Execute query
  const result = await queryFn();

  // Cache result
  if (options.enabled !== false && redisClient.isReady()) {
    try {
      const redis = redisClient.getClient();
      const ttl = options.ttl || DEFAULT_TTL;

      const cacheData = {
        result,
        cachedAt: new Date().toISOString(),
        tags: options.tags || [],
      };

      await redis.setex(cacheKey, ttl, JSON.stringify(cacheData));

      // Store tags
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await redis.sadd(`query:tag:${tag}`, cacheKey);
          await redis.expire(`query:tag:${tag}`, ttl);
        }
      }

      logger.debug({ cacheKey, ttl }, 'Query result cached (decorator)');
    } catch (error) {
      logger.error({ error, cacheKey }, 'Failed to cache query result');
    }
  }

  return result;
}

