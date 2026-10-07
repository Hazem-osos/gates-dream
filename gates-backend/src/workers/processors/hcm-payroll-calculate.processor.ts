import { Worker, Job } from 'bullmq';
import { HcmPayrollCalculateJobData, HCM_PAYROLL_CALCULATE_QUEUE_NAME } from '../queues/hcm-payroll-calculate.queue';
import { workerRedisConnection } from '../redis-connection';
import { logger } from '../../shared/logger';
import { payrollRunCalculationService } from '../../modules/hr/services/payroll/payroll-run-calculation.service';
import prisma from '../../shared/database/prisma';

export async function processHcmPayrollCalculateJob(
  data: HcmPayrollCalculateJobData,
  progress?: (pct: number) => Promise<void>
): Promise<{ payrollRunId: string; reused: boolean }> {
  const { companyId, periodYear, periodMonth, requestedBy, idempotencyKey } = data;
  const existing = await prisma.payrollRun.findFirst({
    where: { companyId, periodYear, periodMonth, calculationJobId: idempotencyKey },
  });
  if (existing) {
    await progress?.(100);
    return { payrollRunId: existing.id, reused: true };
  }
  await progress?.(10);
  const run = await payrollRunCalculationService.createPayrollRun(companyId, {
    periodYear,
    periodMonth,
    calculatedById: requestedBy,
  });
  await prisma.payrollRun.update({
    where: { id: run.id },
    data: { calculationJobId: idempotencyKey },
  });
  await progress?.(100);
  return { payrollRunId: run.id, reused: false };
}

export const createHcmPayrollCalculateWorker = (): Worker<HcmPayrollCalculateJobData> => {
  return new Worker<HcmPayrollCalculateJobData>(
    HCM_PAYROLL_CALCULATE_QUEUE_NAME,
    async (job: Job<HcmPayrollCalculateJobData>) => {
      const { companyId, periodYear, periodMonth } = job.data;
      logger.info({ jobId: job.id, companyId, periodYear, periodMonth }, 'HCM payroll calculate job');
      return processHcmPayrollCalculateJob(job.data, (pct) => job.updateProgress(pct));
    },
    { connection: workerRedisConnection, concurrency: 2 }
  );
};
