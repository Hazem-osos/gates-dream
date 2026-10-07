import { Queue } from 'bullmq';
import { lazyBullmqQueue, workerRedisConnection } from '../redis-connection';
import type { BatchRecalcScope } from '../../modules/hr/services/time/hcm-time-batch.service';

export const HCM_TIME_QUEUE_NAME = 'hcm-time-recalc';

export type HcmTimeRecalcJobData = {
  companyId: string;
  scope: BatchRecalcScope;
  requestedBy?: string;
};

function createHcmTimeQueue() {
  return new Queue<HcmTimeRecalcJobData>(HCM_TIME_QUEUE_NAME, {
    connection: workerRedisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86_400, count: 500 },
      removeOnFail: { age: 604_800 },
    },
  });
}

export const hcmTimeQueue = lazyBullmqQueue(createHcmTimeQueue);
