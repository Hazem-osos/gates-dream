import { Queue, Worker, type Job } from 'bullmq';
import { env } from '../../../shared/config/env';
import { logger } from '../../../shared/logger';
import { workerRedisConnection } from '../../../workers/redis-connection';
import { proactiveCfoJob } from './proactive-cfo.job';

export const PROACTIVE_QUEUE_NAME = 'ai-proactive';
export const PROACTIVE_JOB_NAME = 'ProactiveCfoScan';
/** 06:00 Africa/Cairo daily — CFO detectors */
export const PROACTIVE_CRON = '0 6 * * *';
/** 08:00 Africa/Cairo — RBAC sentinel notifications */
export const SENTINEL_RBAC_CRON = '0 8 * * *';
export const PROACTIVE_TZ = 'Africa/Cairo';

export type ProactiveJobData = {
  kind: 'orchestrator' | 'tenant';
  companyId?: string;
};

let queue: Queue<ProactiveJobData> | undefined;
let worker: Worker<ProactiveJobData> | undefined;

function getQueue(): Queue<ProactiveJobData> {
  queue ??= new Queue<ProactiveJobData>(PROACTIVE_QUEUE_NAME, {
    connection: workerRedisConnection,
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: { age: 86_400, count: 200 },
      removeOnFail: { age: 604_800 },
    },
  });
  return queue;
}

export async function processProactiveJob(job: Job<ProactiveJobData>) {
  if (job.data.kind === 'tenant' && job.data.companyId) {
    return proactiveCfoJob.runForCompany(job.data.companyId);
  }
  return proactiveCfoJob.runAllActiveCompanies();
}

export async function scheduleProactiveCfoJob(): Promise<void> {
  if (!env.REDIS_ENABLED) {
    logger.warn('Redis disabled — proactive CFO cron was not registered');
    return;
  }
  await getQueue().upsertJobScheduler(
    'proactive-cfo-daily',
    { pattern: PROACTIVE_CRON, tz: PROACTIVE_TZ },
    {
      name: PROACTIVE_JOB_NAME,
      data: { kind: 'orchestrator' },
    }
  );
  await getQueue().upsertJobScheduler(
    'rbac-sentinel-morning',
    { pattern: SENTINEL_RBAC_CRON, tz: PROACTIVE_TZ },
    {
      name: PROACTIVE_JOB_NAME,
      data: { kind: 'orchestrator' },
    }
  );
  logger.info(
    { cron: PROACTIVE_CRON, sentinelCron: SENTINEL_RBAC_CRON, tz: PROACTIVE_TZ },
    'Proactive CFO and RBAC sentinel scans scheduled'
  );
}

export function startProactiveCfoWorker(): Worker<ProactiveJobData> | undefined {
  if (!env.REDIS_ENABLED || worker) return worker;
  worker = new Worker<ProactiveJobData>(PROACTIVE_QUEUE_NAME, processProactiveJob, {
    connection: workerRedisConnection,
  });
  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Proactive CFO job completed');
  });
  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Proactive CFO job failed');
  });
  return worker;
}

export async function closeProactiveCfoJobs(): Promise<void> {
  await Promise.allSettled([worker?.close(), queue?.close()]);
  worker = undefined;
  queue = undefined;
}
