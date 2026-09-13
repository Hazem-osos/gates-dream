import { logger } from '../../../shared/logger';
import { env } from '../../../shared/config/env';
import {
  CHEQUE_MATURITY_CRON_UTC,
  DYNAMIC_PRICING_CRON_UTC,
  LATE_FEE_CRON_UTC,
} from '../constants';
import { automationJobOptions, automationSchedulersQueue } from '../queues/automation.queues';
import { AUTOMATION_JOB_NAMES } from '../types/automation-jobs.types';

export async function scheduleAutomationJobs(): Promise<void> {
  if (!env.REDIS_ENABLED) {
    logger.warn('Redis disabled — automation cron jobs were not registered');
    return;
  }

  await automationSchedulersQueue.upsertJobScheduler(
    'daily-late-fee-accrual',
    { pattern: LATE_FEE_CRON_UTC },
    {
      name: AUTOMATION_JOB_NAMES.dailyLateFee,
      data: { kind: 'orchestrator', asOfDate: '' },
      opts: automationJobOptions(),
    }
  );

  await automationSchedulersQueue.upsertJobScheduler(
    'cheque-maturity-reminder',
    { pattern: CHEQUE_MATURITY_CRON_UTC },
    {
      name: AUTOMATION_JOB_NAMES.chequeMaturity,
      data: { asOfDate: '' },
      opts: automationJobOptions(),
    }
  );

  await automationSchedulersQueue.upsertJobScheduler(
    'dynamic-pricing-revaluation',
    { pattern: DYNAMIC_PRICING_CRON_UTC },
    {
      name: AUTOMATION_JOB_NAMES.dynamicPricing,
      data: { kind: 'orchestrator', asOfDate: '' },
      opts: automationJobOptions(),
    }
  );

  logger.info(
    {
      dailyLateFee: LATE_FEE_CRON_UTC,
      chequeMaturity: CHEQUE_MATURITY_CRON_UTC,
      dynamicPricing: DYNAMIC_PRICING_CRON_UTC,
    },
    'Automation repeatable jobs registered (UTC cron)'
  );
}
