import { Queue, Worker } from 'bullmq';
import { logger } from '../../shared/logger';
import { isRedisEnabledFlag, workerConsumerConnection, workerRedisConnection } from '../../workers/redis-connection';
import { drainEreceiptOutbox } from './submit.service';

const QUEUE = 'ereceipt-drain';

let worker: Worker | null = null;
let queue: Queue | null = null;

export function registerEreceiptWorker(): void {
  if (!isRedisEnabledFlag() || worker) return;
  queue = new Queue(QUEUE, { connection: workerRedisConnection });
  worker = new Worker(
    QUEUE,
    async () => {
      await drainEreceiptOutbox();
    },
    { connection: workerConsumerConnection, concurrency: 1 }
  );
  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, message: error.message }, 'eReceipt drain job failed');
  });
  void queue.add('drain', {}, { repeat: { every: 30_000 }, jobId: 'ereceipt-drain' }).catch((error) => {
    logger.error({ message: error instanceof Error ? error.message : 'queue' }, 'eReceipt repeatable job was not registered');
  });
}

export async function closeEreceiptWorker(): Promise<void> {
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
}
