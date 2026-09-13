import { logger } from '../logger';
import { redisClient } from '../cache/redis';
import { env } from '../config/env';

export interface DeadLetterQueueEntry {
  id: string;
  jobId: string;
  queue: string;
  error: string;
  data: any;
  timestamp: Date;
  retryCount: number;
}

export class DeadLetterQueue {
  private readonly prefix = 'dlq:';
  private readonly maxEntries = 1000; // Max entries per queue

  /**
   * Add a failed job to dead letter queue
   */
  async add(
    queue: string,
    jobId: string,
    error: Error,
    data: any,
    retryCount: number = 0
  ): Promise<void> {
    if (!env.REDIS_ENABLED) {
      logger.warn('Redis not enabled, cannot add to DLQ');
      return;
    }

    try {
      const entry: DeadLetterQueueEntry = {
        id: `${queue}:${jobId}`,
        jobId,
        queue,
        error: error.message,
        data,
        timestamp: new Date(),
        retryCount,
      };

      const key = `${this.prefix}${queue}:${jobId}`;
      const client = redisClient.getClient();

      // Store entry with expiration (30 days)
      await client.setex(
        key,
        30 * 24 * 60 * 60,
        JSON.stringify(entry)
      );

      // Add to queue list (for listing)
      await client.zadd(
        `${this.prefix}${queue}:list`,
        Date.now(),
        jobId
      );

      // Limit queue size
      await client.zremrangebyrank(
        `${this.prefix}${queue}:list`,
        0,
        -(this.maxEntries + 1)
      );

      logger.error(
        { queue, jobId, error: error.message, retryCount },
        'Job added to dead letter queue'
      );
    } catch (err) {
      logger.error({ err, queue, jobId }, 'Failed to add to dead letter queue');
    }
  }

  /**
   * Get entries from dead letter queue
   */
  async getEntries(
    queue: string,
    limit: number = 100
  ): Promise<DeadLetterQueueEntry[]> {
    if (!env.REDIS_ENABLED) {
      return [];
    }

    try {
      const client = redisClient.getClient();
      const jobIds = await client.zrevrange(
        `${this.prefix}${queue}:list`,
        0,
        limit - 1
      );

      const entries: DeadLetterQueueEntry[] = [];
      for (const jobId of jobIds) {
        const key = `${this.prefix}${queue}:${jobId}`;
        const data = await client.get(key);
        if (data) {
          entries.push(JSON.parse(data));
        }
      }

      return entries;
    } catch (err) {
      logger.error({ err, queue }, 'Failed to get dead letter queue entries');
      return [];
    }
  }

  /**
   * Remove entry from dead letter queue
   */
  async remove(queue: string, jobId: string): Promise<void> {
    if (!env.REDIS_ENABLED) {
      return;
    }

    try {
      const client = redisClient.getClient();
      const key = `${this.prefix}${queue}:${jobId}`;
      await client.del(key);
      await client.zrem(`${this.prefix}${queue}:list`, jobId);
      logger.info({ queue, jobId }, 'Removed from dead letter queue');
    } catch (err) {
      logger.error({ err, queue, jobId }, 'Failed to remove from dead letter queue');
    }
  }

  /**
   * Get count of entries in queue
   */
  async getCount(queue: string): Promise<number> {
    if (!env.REDIS_ENABLED) {
      return 0;
    }

    try {
      const client = redisClient.getClient();
      return await client.zcard(`${this.prefix}${queue}:list`);
    } catch (err) {
      logger.error({ err, queue }, 'Failed to get dead letter queue count');
      return 0;
    }
  }
}

export const deadLetterQueue = new DeadLetterQueue();

