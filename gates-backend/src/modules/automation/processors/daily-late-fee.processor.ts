import type { Job } from 'bullmq';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { lateFeeCalculationService } from '../../real-estate/services/late-fee-calculation.service';
import { money, moneyZero, sumMoney } from '../../real-estate/utils/money-decimal';
import { AUTOMATION_JOB_NAMES } from '../types/automation-jobs.types';
import type {
  DailyLateFeeJobData,
  DailyLateFeeOrchestratorResult,
  DailyLateFeeTenantResult,
} from '../types/automation-jobs.types';
import { automationJobOptions, automationSchedulersQueue } from '../queues/automation.queues';
import { claimIdempotencyKey, lateFeeIdempotencyKey } from '../redis/job-idempotency';
import { dailyLateFeeJobId, utcDateKey } from '../utils/job-ids';

async function listActiveCompanyIds(): Promise<string[]> {
  const companies = await prisma.company.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true },
  });
  return companies.map((row) => row.id);
}

export async function processTenantLateFees(
  companyId: string,
  asOfDate: Date
): Promise<DailyLateFeeTenantResult> {
  const dateKey = utcDateKey(asOfDate);
  const claimed = await claimIdempotencyKey(lateFeeIdempotencyKey(companyId, dateKey));
  if (!claimed) {
    logger.info({ companyId, dateKey }, 'Daily late-fee accrual skipped (idempotent)');
    return { companyId, skipped: true, processedCount: 0, totalLateFees: '0.0000' };
  }

  const result = await lateFeeCalculationService.calculateAndApplyOverdueLateFees(companyId, asOfDate);
  const totalLateFees = sumMoney(result.installments.map((row) => row.accumulatedLateFee));
  const tenantResult: DailyLateFeeTenantResult = {
    companyId,
    skipped: false,
    processedCount: result.processedCount,
    totalLateFees: money(totalLateFees).toFixed(4),
  };
  logger.info({ ...tenantResult, dateKey }, 'Daily late-fee accrual applied for tenant');
  return tenantResult;
}

export async function processDailyLateFeeJob(
  job: Job<DailyLateFeeJobData>
): Promise<DailyLateFeeTenantResult | DailyLateFeeOrchestratorResult> {
  const asOfDate = job.data.asOfDate ? new Date(job.data.asOfDate) : new Date();
  const dateKey = utcDateKey(asOfDate);

  if (job.data.kind === 'tenant') {
    if (!job.data.companyId) throw new Error('DailyLateFeeAccrualJob tenant job missing companyId');
    return processTenantLateFees(job.data.companyId, asOfDate);
  }

  const companyIds = await listActiveCompanyIds();
  const failures: Array<{ companyId: string; error: string }> = [];
  let enqueued = 0;

  for (const companyId of companyIds) {
    try {
      await automationSchedulersQueue.add(
        AUTOMATION_JOB_NAMES.dailyLateFee,
        { kind: 'tenant', companyId, asOfDate: dateKey },
        {
          ...automationJobOptions(),
          jobId: dailyLateFeeJobId(companyId, dateKey),
        }
      );
      enqueued += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already (exists|exists)/i.test(message) || message.includes('Job is already')) {
        logger.info({ companyId, dateKey }, 'Late-fee tenant job already queued or completed today');
        continue;
      }
      failures.push({ companyId, error: message });
      logger.error({ error, companyId, jobId: job.id }, 'Failed to enqueue tenant late-fee job');
    }
  }

  const summary: DailyLateFeeOrchestratorResult = {
    asOfDate: dateKey,
    tenantsAttempted: companyIds.length,
    tenantsSucceeded: enqueued,
    tenantsFailed: failures.length,
    tenantsSkipped: companyIds.length - enqueued - failures.length,
    processedInstallments: 0,
    totalLateFees: moneyZero().toFixed(4),
    failures,
  };

  logger.info({ jobId: job.id, ...summary }, 'Daily late-fee accrual jobs enqueued');
  return summary;
}
