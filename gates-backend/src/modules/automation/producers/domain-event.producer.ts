import { logger } from '../../../shared/logger';
import { env } from '../../../shared/config/env';
import {
  automationJobOptions,
  automationSchedulersQueue,
  realEstateCancellationsQueue,
  realEstateChequesQueue,
  subcontractWorkflowsQueue,
} from '../queues/automation.queues';
import { AUTOMATION_JOB_NAMES } from '../types/automation-jobs.types';
import type {
  ChequeBouncedJobData,
  DynamicPricingJobData,
  SubcontractInvoiceWorkflowJobData,
  UnitCancellationReleasedJobData,
} from '../types/automation-jobs.types';
import {
  chequeBouncedJobId,
  dynamicPricingJobId,
  subcontractWorkflowJobId,
  unitCancellationJobId,
  utcDateKey,
  utcIsoWeekKey,
} from '../utils/job-ids';

async function enqueueOrLog(label: string, work: () => Promise<unknown>): Promise<void> {
  if (!env.REDIS_ENABLED) {
    logger.info({ label }, 'Redis disabled — skipping automation enqueue');
    return;
  }
  try {
    await work();
  } catch (error) {
    logger.warn({ error, label }, 'Failed to enqueue automation job');
  }
}

export async function enqueueChequeBouncedJob(data: ChequeBouncedJobData): Promise<void> {
  await enqueueOrLog('ChequeBouncedJob', () =>
    realEstateChequesQueue.add(AUTOMATION_JOB_NAMES.chequeBounced, data, {
      ...automationJobOptions(),
      jobId: chequeBouncedJobId(data.chequeId),
    })
  );
}

export async function enqueueSubcontractInvoiceWorkflowJob(
  data: SubcontractInvoiceWorkflowJobData
): Promise<void> {
  await enqueueOrLog('SubcontractorInvoiceWorkflowJob', () =>
    subcontractWorkflowsQueue.add(AUTOMATION_JOB_NAMES.subcontractWorkflow, data, {
      ...automationJobOptions(),
      jobId: subcontractWorkflowJobId(data.invoiceId, data.toStatus),
    })
  );
}

export async function enqueueUnitCancellationReleasedJob(
  data: UnitCancellationReleasedJobData
): Promise<void> {
  await enqueueOrLog('UnitCancellationReleasedJob', () =>
    realEstateCancellationsQueue.add(AUTOMATION_JOB_NAMES.unitCancellation, data, {
      ...automationJobOptions(),
      jobId: unitCancellationJobId(data.settlementId),
    })
  );
}

export async function enqueueDynamicPricingJob(input: {
  companyId?: string;
  requestedBy?: string;
}): Promise<void> {
  const asOfDate = utcDateKey();
  const data: DynamicPricingJobData = {
    kind: input.companyId ? 'tenant' : 'orchestrator',
    companyId: input.companyId,
    requestedBy: input.requestedBy,
    asOfDate,
  };
  const jobId = input.companyId
    ? dynamicPricingJobId(input.companyId, `${utcIsoWeekKey()}-ondemand`)
    : `dynamic-pricing-orchestrator-ondemand-${asOfDate}`;

  await enqueueOrLog('DynamicPricingRevaluationJob', () =>
    automationSchedulersQueue.add(AUTOMATION_JOB_NAMES.dynamicPricing, data, {
      ...automationJobOptions(),
      jobId,
    })
  );
}
