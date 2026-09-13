import Redis from 'ioredis';
import { logger } from '../logger';

/**
 * Redis Client Singleton
 * Manages Redis connection for caching and job queue
 */

class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;
  private readyHandlers: Array<() => void> = [];

  /**
   * Initialize Redis connection
   */
  initialize(): Redis {
    if (this.client && this.isConnected) {
      return this.client;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn({ times, delay }, 'Redis connection retry');
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          logger.error({ err }, 'Redis READONLY error, reconnecting');
          return true;
        }
        return false;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => {
      logger.info('Redis connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis ready');
      for (const handler of this.readyHandlers) {
        try {
          handler();
        } catch (err) {
          logger.warn({ err }, 'Redis onReady handler failed');
        }
      }
    });

    this.client.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    return this.client;
  }

  /**
   * Get Redis client instance
   */
  getClient(): Redis {
    if (!this.client) {
      return this.initialize();
    }
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client?.status === 'ready';
  }

  /** Invoked on every `ready` (including reconnect). Handlers must be cheap. */
  onReady(handler: () => void): void {
    this.readyHandlers.push(handler);
    if (this.client?.status === 'ready') handler();
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }
}

export const redisClient = new RedisClient();

// Wave 6 fix: this module-load side effect used to connect to Redis whenever
// `REDIS_ENABLED` wasn't literally `'false'` — the same permissive default
// fixed in `env.ts`'s `REDIS_ENABLED` parsing — independently of and ahead
// of `index.ts`'s explicit `redisClient.initialize()` call, which is gated
// on the validated `env.REDIS_ENABLED`. A box that correctly resolved
// `env.REDIS_ENABLED` to `false` still ended up with a live Redis
// connection attempt from this side effect. Initialization now happens
// exactly once, from `index.ts`.

export default redisClient.getClient();
