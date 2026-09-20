import { Worker, type Job } from 'bullmq';
import { logger } from '../../../shared/logger';
import { workerRedisConnection } from '../../../workers/redis-connection';
import { AUTOMATION_JOB_NAMES, AUTOMATION_QUEUE_NAMES } from '../types/automation-jobs.types';
import type {
  ChequeMaturityJobData,
  DailyLateFeeJobData,
  DynamicPricingJobData,
  SalesInvoiceOverdueScanJobData,
} from '../types/automation-jobs.types';
import { processChequeMaturityJob } from './cheque-maturity.processor';
import { processDailyLateFeeJob } from './daily-late-fee.processor';
import { processDynamicPricingJob } from './dynamic-pricing.processor';
import { processSalesInvoiceOverdueScanJob } from './sales-invoice-overdue.processor';

type SchedulerJobData =
  | DailyLateFeeJobData
  | ChequeMaturityJobData
  | DynamicPricingJobData
  | SalesInvoiceOverdueScanJobData;

export async function processSchedulerJob(job: Job<SchedulerJobData>) {
  switch (job.name) {
    case AUTOMATION_JOB_NAMES.dailyLateFee:
      return processDailyLateFeeJob(job as Job<DailyLateFeeJobData>);
    case AUTOMATION_JOB_NAMES.chequeMaturity:
      return processChequeMaturityJob(job as Job<ChequeMaturityJobData>);
    case AUTOMATION_JOB_NAMES.dynamicPricing:
      return processDynamicPricingJob(job as Job<DynamicPricingJobData>);
    case AUTOMATION_JOB_NAMES.salesInvoiceOverdue:
      return processSalesInvoiceOverdueScanJob(job as Job<SalesInvoiceOverdueScanJobData>);
    default:
      logger.warn({ jobId: job.id, name: job.name }, 'Unknown automation scheduler job');
      return;
  }
}

export function createAutomationSchedulersWorker(): Worker<SchedulerJobData> {
  const worker = new Worker<SchedulerJobData>(
    AUTOMATION_QUEUE_NAMES.schedulers,
    processSchedulerJob,
    { connection: workerRedisConnection }
  );
  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Automation scheduler job completed');
  });
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, error: err }, 'Automation scheduler job failed');
  });
  worker.on('error', (err) => {
    logger.error({ error: err }, 'Automation scheduler worker error');
  });
  return worker;
}
