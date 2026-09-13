import type { Queue } from 'bullmq';
import { bullmqRedisPool } from './redis-pool';

/**
 * Shared producer connection for BullMQ `Queue` instances.
 * Workers should use `workerConsumerConnection` instead.
 *
 * Do not construct a BullMQ `Queue` at module load. Queue constructors
 * issue Redis commands immediately and were the remaining
 * ECONNREFUSED 127.0.0.1:6379 source after REDIS_ENABLED=false.
 */
export const workerRedisConnection = bullmqRedisPool.producer;
export const workerConsumerConnection = bullmqRedisPool.consumer;

export function isRedisEnabledFlag(): boolean {
  return ['true', '1', 'yes', 'on'].includes((process.env.REDIS_ENABLED ?? '').trim().toLowerCase());
}

/** Build the real Queue on first method access, never at import time. */
export function lazyBullmqQueue<T>(factory: () => Queue<T>): Queue<T> {
  let queue: Queue<T> | undefined;
  return new Proxy({} as Queue<T>, {
    get(_target, prop) {
      if (!isRedisEnabledFlag()) {
        throw new Error('Background jobs need REDIS_ENABLED=true and a reachable Redis');
      }
      queue ??= factory();
      const value = Reflect.get(queue, prop, queue);
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(queue) : value;
    },
  });
}
