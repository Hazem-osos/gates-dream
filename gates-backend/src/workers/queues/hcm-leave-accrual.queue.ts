import { Queue } from 'bullmq';
import { lazyBullmqQueue, workerRedisConnection } from '../redis-connection';

export const HCM_LEAVE_ACCRUAL_QUEUE_NAME = 'hcm-leave-accrual';

export type HcmLeaveAccrualJobData = {
  companyId: string;
  year: number;
  month: number;
  requestedBy?: string;
};

function createHcmLeaveAccrualQueue() {
  return new Queue<HcmLeaveAccrualJobData>(HCM_LEAVE_ACCRUAL_QUEUE_NAME, {
    connection: workerRedisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86_400, count: 200 },
      removeOnFail: { age: 604_800 },
    },
  });
}

export const hcmLeaveAccrualQueue = lazyBullmqQueue(createHcmLeaveAccrualQueue);
