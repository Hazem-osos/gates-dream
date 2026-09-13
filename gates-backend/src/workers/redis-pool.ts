import IORedis from 'ioredis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * BullMQ needs dedicated ioredis clients with `maxRetriesPerRequest: null`.
 * The API process uses the producer connection (Queue.add / getJob).
 * The worker process uses the consumer connection (Worker).
 *
 * `lazyConnect` keeps REDIS_ENABLED=false installs from opening a socket
 * on module import — the first command (enqueue) is what actually dials.
 */
const baseOptions = {
  maxRetriesPerRequest: null as null,
  lazyConnect: true,
  enableReadyCheck: true,
};

function createPooledConnection(connectionName: string): IORedis {
  const client = new IORedis(url, { ...baseOptions, connectionName });
  client.on('error', () => {
    // REDIS_ENABLED=false (or Redis down): do not crash the API or flood logs.
  });
  return client;
}

export const bullmqRedisPool = {
  producer: createPooledConnection('gates-bullmq-producer'),
  consumer: createPooledConnection('gates-bullmq-consumer'),
};

export async function closeBullmqRedisPool(): Promise<void> {
  await Promise.allSettled([
    bullmqRedisPool.producer.quit(),
    bullmqRedisPool.consumer.quit(),
  ]);
}
