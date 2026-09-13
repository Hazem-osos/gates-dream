import { bullmqRedisPool } from './redis-pool';

/**
 * Shared producer connection for BullMQ `Queue` instances.
 * Workers should use `workerConsumerConnection` instead.
 *
 * Wave 6 fix: `payroll.queue.ts`/`reports.queue.ts` instantiate a BullMQ
 * `Queue` at module load, and those modules are imported unconditionally by
 * `payroll.routes.ts`/`reports.routes.ts`/`job-status.routes.ts` — which
 * `app.ts` always loads regardless of `REDIS_ENABLED`. Without `lazyConnect`,
 * ioredis dials Redis the moment this module is imported. The pool defers
 * the actual connection until the first command is issued.
 */
export const workerRedisConnection = bullmqRedisPool.producer;
export const workerConsumerConnection = bullmqRedisPool.consumer;
