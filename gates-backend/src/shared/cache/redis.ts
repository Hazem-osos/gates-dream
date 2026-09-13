import Redis from 'ioredis';
import { logger } from '../logger';

/**
 * Redis Client Singleton
 * Manages Redis connection for caching and job queue.
 *
 * Must only connect when REDIS_ENABLED is explicitly true. Importing this
 * module must never open a socket — Railway/local boxes without Redis were
 * flooding logs with ECONNREFUSED 127.0.0.1:6379 from a default-export
 * side effect that called getClient() at load time.
 */

function isRedisEnabledFlag(): boolean {
  return ['true', '1', 'yes', 'on'].includes((process.env.REDIS_ENABLED ?? '').trim().toLowerCase());
}

class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;
  private readyHandlers: Array<() => void> = [];
  private lastErrorLogAt = 0;

  /**
   * Initialize Redis connection. No-op when Redis is disabled.
   */
  initialize(): Redis | null {
    if (!isRedisEnabledFlag()) {
      return null;
    }

    if (this.client && this.isConnected) {
      return this.client;
    }

    if (this.client) {
      return this.client;
    }

    const redisUrl = process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379';

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 10) {
          return 30_000;
        }
        return Math.min(times * 200, 5_000);
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          logger.error({ err }, 'Redis READONLY error, reconnecting');
          return true;
        }
        return false;
      },
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
      this.isConnected = false;
      const now = Date.now();
      if (now - this.lastErrorLogAt > 30_000) {
        this.lastErrorLogAt = now;
        logger.warn({ err }, 'Redis connection error (retries continue in background)');
      }
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });

    void this.client.connect().catch((err) => {
      const now = Date.now();
      if (now - this.lastErrorLogAt > 30_000) {
        this.lastErrorLogAt = now;
        logger.warn({ err }, 'Redis initial connect failed');
      }
    });

    return this.client;
  }

  /**
   * Get Redis client instance. Throws if Redis was never initialized.
   */
  getClient(): Redis {
    if (!this.client) {
      throw new Error(
        'Redis client is not initialized. Set REDIS_ENABLED=true and call redisClient.initialize().'
      );
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
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }
}

export const redisClient = new RedisClient();
