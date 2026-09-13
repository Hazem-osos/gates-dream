import { Queue, type JobsOptions, type Job } from 'bullmq';
import { logger } from '../shared/logger';
import { bullmqRedisPool } from './redis-pool';

export const ASYNC_QUEUE_NAMES = {
  PDF_GENERATION: 'pdf-generation',
  TAX_PORTAL_SYNC: 'tax-portal-sync',
  REPORT_EXPORT: 'report-export',
} as const;

export type AsyncQueueName = (typeof ASYNC_QUEUE_NAMES)[keyof typeof ASYNC_QUEUE_NAMES];

export const DEFAULT_ASYNC_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 86_400, count: 1000 },
  removeOnFail: { age: 604_800 },
};

const queues = new Map<string, Queue>();

export function getQueue<T = unknown>(name: string): Queue<T, unknown, string> {
  const existing = queues.get(name);
  if (existing) return existing as Queue<T, unknown, string>;

  const queue = new Queue<T, unknown, string>(name, {
    connection: bullmqRedisPool.producer,
    defaultJobOptions: DEFAULT_ASYNC_JOB_OPTIONS,
  });
  queues.set(name, queue);
  return queue;
}

export function getAsyncQueue<T = unknown>(name: AsyncQueueName): Queue<T, unknown, string> {
  return getQueue<T>(name);
}

export async function enqueueJob<T extends { companyId: string }>(
  queueName: AsyncQueueName,
  jobName: string,
  data: T,
  options: JobsOptions = {}
): Promise<Job<T>> {
  const queue = getQueue(queueName) as Queue;
  const job = (await queue.add(jobName, data, options)) as Job<T>;
  logger.info(
    { queue: queueName, jobName, jobId: job.id, companyId: data.companyId },
    'Async job enqueued'
  );
  return job;
}

export async function findJobAcrossQueues(jobId: string): Promise<Job | undefined> {
  for (const name of Object.values(ASYNC_QUEUE_NAMES)) {
    const job = await getAsyncQueue(name).getJob(jobId);
    if (job) return job;
  }
  return undefined;
}

export async function closeQueueManager(): Promise<void> {
  await Promise.allSettled([...queues.values()].map((q) => q.close()));
  queues.clear();
}

export const queueManager = {
  getQueue,
  getAsyncQueue,
  enqueue: enqueueJob,
  findJob: findJobAcrossQueues,
  close: closeQueueManager,
  names: ASYNC_QUEUE_NAMES,
};
