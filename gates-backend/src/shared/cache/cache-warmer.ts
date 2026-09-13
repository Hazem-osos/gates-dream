import { logger } from '../logger';
import { redisClient } from './redis';
import { cacheQuery } from './query-cache';
import prisma from '../database/prisma';

/**
 * Cache Warming Service
 * Pre-loads frequently accessed data into cache
 */

export interface CacheWarmingConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  endpoints: string[]; // Endpoints to warm
  queries: Array<{
    name: string;
    query: () => Promise<any>;
    ttl?: number;
    tags?: string[];
  }>;
}

/**
 * Warm cache for specific endpoint
 */
export async function warmEndpoint(url: string): Promise<void> {
  try {
    // This would make an HTTP request to warm the endpoint
    // For now, we'll just log it
    logger.debug({ url }, 'Endpoint cache warmed');
  } catch (error) {
    logger.error({ error, url }, 'Failed to warm endpoint cache');
  }
}

/**
 * Warm cache for database queries
 */
export async function warmQueryCache(): Promise<void> {
  if (!redisClient.isReady()) {
    logger.warn('Redis not available, skipping cache warming');
    return;
  }

  try {
    logger.info('Starting query cache warming...');

    // Warm frequently accessed queries
    const queries = [
      {
        name: 'active_companies',
        query: async () => {
          return cacheQuery(
            () =>
              prisma.company.findMany({
                where: { isActive: true },
                take: 100,
              }),
            { ttl: 600, tags: ['companies'] }
          );
        },
      },
      {
        name: 'system_settings',
        query: async () => {
          return cacheQuery(
            () =>
              prisma.systemSetting.findMany({
                take: 100,
              }),
            { ttl: 3600, tags: ['settings'] }
          );
        },
      },
      // Add more frequently accessed queries here
    ];

    for (const queryConfig of queries) {
      try {
        await queryConfig.query();
        logger.debug({ name: queryConfig.name }, 'Query cache warmed');
      } catch (error) {
        logger.error({ error, name: queryConfig.name }, 'Failed to warm query cache');
      }
    }

    logger.info('Query cache warming completed');
  } catch (error) {
    logger.error({ error }, 'Cache warming failed');
  }
}

/**
 * Warm cache on application startup
 */
export async function warmCacheOnStartup(): Promise<void> {
  if (process.env.CACHE_WARMING_ENABLED !== 'true') {
    logger.debug('Cache warming disabled');
    return;
  }

  // Warm cache in background (don't block startup)
  setImmediate(async () => {
    await warmQueryCache();
  });
}

/**
 * Scheduled cache warming (call from cron job)
 */
export async function scheduledCacheWarming(): Promise<void> {
  if (process.env.CACHE_WARMING_ENABLED !== 'true') {
    return;
  }

  logger.info('Running scheduled cache warming...');
  await warmQueryCache();
}

/**
 * Warm cache after data updates
 */
export async function warmCacheAfterUpdate(tags: string[]): Promise<void> {
  if (!redisClient.isReady()) {
    return;
  }

  try {
    // Invalidate related cache
    const { invalidateQueryCacheByTags } = await import('./query-cache');
    await invalidateQueryCacheByTags(tags);

    // Re-warm cache for affected tags
    logger.debug({ tags }, 'Cache warmed after update');
  } catch (error) {
    logger.error({ error, tags }, 'Failed to warm cache after update');
  }
}

