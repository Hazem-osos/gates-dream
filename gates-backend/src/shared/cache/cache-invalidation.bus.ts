import Redis from 'ioredis';
import { logger } from '../logger';
import { redisClient } from './redis';

export const CACHE_INVALIDATE_CHANNEL = 'gates:cache:invalidate';

let subscriber: Redis | null = null;

export type CacheInvalidateMessage = {
  prefix: string;
};

const pendingInvalidationPrefixes = new Set<string>();

export async function flushPendingCacheInvalidations(): Promise<void> {
  if (!pendingInvalidationPrefixes.size || !redisClient.isReady()) return;
  const prefixes = [...pendingInvalidationPrefixes];
  pendingInvalidationPrefixes.clear();
  for (const prefix of prefixes) {
    try {
      await redisClient.getClient().publish(
        CACHE_INVALIDATE_CHANNEL,
        JSON.stringify({ prefix } satisfies CacheInvalidateMessage)
      );
    } catch (err) {
      pendingInvalidationPrefixes.add(prefix);
      logger.error({ err, prefix }, 'Retry of queued cache invalidation failed');
    }
  }
}

/**
 * Publish an L1 drop to other instances. Never silently no-ops: if Redis
 * is down the prefix is queued and the caller gets `false` so it can flush
 * local L1 and log.
 */
export async function publishCacheInvalidation(prefix: string): Promise<boolean> {
  if (!redisClient.isReady()) {
    pendingInvalidationPrefixes.add(prefix);
    logger.error({ prefix }, 'Cache invalidation queued: Redis publisher is not ready');
    return false;
  }
  try {
    await redisClient.getClient().publish(
      CACHE_INVALIDATE_CHANNEL,
      JSON.stringify({ prefix } satisfies CacheInvalidateMessage)
    );
    return true;
  } catch (err) {
    pendingInvalidationPrefixes.add(prefix);
    logger.error({ err, prefix }, 'Cache invalidation publish failed');
    return false;
  }
}

export function subscribeCacheInvalidation(
  onPrefix: (prefix: string) => void
): void {
  if (subscriber) return;
  const redisOn = ['true', '1', 'yes', 'on'].includes(
    (process.env.REDIS_ENABLED ?? '').trim().toLowerCase()
  );
  if (!redisOn) return;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  subscriber = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

  subscriber.on('error', (err) => {
    logger.warn({ err }, 'Cache invalidation subscriber error');
  });

  subscriber.on('ready', () => {
    logger.info('Cache invalidation subscriber reconnected — flushing local L1');
    onPrefix('');
  });

  void subscriber.subscribe(CACHE_INVALIDATE_CHANNEL, (err) => {
    if (err) {
      logger.warn({ err }, 'Failed to subscribe to cache invalidation channel');
      return;
    }
    logger.info({ channel: CACHE_INVALIDATE_CHANNEL }, 'Cache invalidation subscriber ready');
  });

  subscriber.on('message', (_channel, raw) => {
    try {
      const parsed = JSON.parse(raw) as CacheInvalidateMessage;
      if (parsed?.prefix) onPrefix(parsed.prefix);
    } catch (err) {
      logger.warn({ err, raw }, 'Invalid cache invalidation payload');
    }
  });
}

export async function disconnectCacheInvalidationSubscriber(): Promise<void> {
  if (!subscriber) return;
  try {
    await subscriber.quit();
  } catch {
    subscriber.disconnect();
  }
  subscriber = null;
}
