import { Queue } from 'bullmq';
import { lazyBullmqQueue, workerRedisConnection } from '../redis-connection';

export const HCM_PAYROLL_CALCULATE_QUEUE_NAME = 'hcm-payroll-calculate';

export type HcmPayrollCalculateJobData = {
  companyId: string;
  payrollRunId?: string;
  periodYear: number;
  periodMonth: number;
  requestedBy?: string;
  idempotencyKey: string;
};

function createHcmPayrollCalculateQueue() {
  return new Queue<HcmPayrollCalculateJobData>(HCM_PAYROLL_CALCULATE_QUEUE_NAME, {
    connection: workerRedisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86_400, count: 200 },
      removeOnFail: { age: 604_800 },
    },
  });
}

export const hcmPayrollCalculateQueue = lazyBullmqQueue(createHcmPayrollCalculateQueue);
