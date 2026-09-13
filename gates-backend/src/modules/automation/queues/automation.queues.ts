import { Queue, type JobsOptions } from 'bullmq';
import { lazyBullmqQueue, workerRedisConnection } from '../../../workers/redis-connection';
import { DEFAULT_AUTOMATION_JOB_OPTIONS } from '../constants';
import {
  AUTOMATION_QUEUE_NAMES,
  type ChequeBouncedJobData,
  type ChequeMaturityJobData,
  type DailyLateFeeJobData,
  type DynamicPricingJobData,
  type SubcontractInvoiceWorkflowJobData,
  type UnitCancellationReleasedJobData,
} from '../types/automation-jobs.types';

export function automationJobOptions(overrides: JobsOptions = {}): JobsOptions {
  return {
    ...DEFAULT_AUTOMATION_JOB_OPTIONS,
    ...overrides,
  };
}

export const automationSchedulersQueue = lazyBullmqQueue(
  () =>
    new Queue<DailyLateFeeJobData | ChequeMaturityJobData | DynamicPricingJobData>(
      AUTOMATION_QUEUE_NAMES.schedulers,
      {
        connection: workerRedisConnection,
        defaultJobOptions: DEFAULT_AUTOMATION_JOB_OPTIONS,
      }
    )
);

export const realEstateChequesQueue = lazyBullmqQueue(
  () =>
    new Queue<ChequeBouncedJobData>(AUTOMATION_QUEUE_NAMES.cheques, {
      connection: workerRedisConnection,
      defaultJobOptions: DEFAULT_AUTOMATION_JOB_OPTIONS,
    })
);

export const subcontractWorkflowsQueue = lazyBullmqQueue(
  () =>
    new Queue<SubcontractInvoiceWorkflowJobData>(AUTOMATION_QUEUE_NAMES.subcontractWorkflows, {
      connection: workerRedisConnection,
      defaultJobOptions: DEFAULT_AUTOMATION_JOB_OPTIONS,
    })
);

export const realEstateCancellationsQueue = lazyBullmqQueue(
  () =>
    new Queue<UnitCancellationReleasedJobData>(AUTOMATION_QUEUE_NAMES.cancellations, {
      connection: workerRedisConnection,
      defaultJobOptions: DEFAULT_AUTOMATION_JOB_OPTIONS,
    })
);

export const automationQueues = [
  automationSchedulersQueue,
  realEstateChequesQueue,
  subcontractWorkflowsQueue,
  realEstateCancellationsQueue,
];
