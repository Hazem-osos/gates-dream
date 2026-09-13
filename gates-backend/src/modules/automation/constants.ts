import type { DefaultJobOptions } from 'bullmq';

/** Synthetic actor written to ActivityLog rows created by workers. */
export const AUTOMATION_SYSTEM_ACTOR_ID = '00000000-0000-4000-a000-000000000001';

export const DEFAULT_AUTOMATION_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: {
    age: 86_400,
    count: 1000,
  },
  removeOnFail: {
    age: 604_800,
  },
};

export const LATE_FEE_CRON_UTC = '5 0 * * *';
export const CHEQUE_MATURITY_CRON_UTC = '0 7 * * *';
export const DYNAMIC_PRICING_CRON_UTC = '0 3 * * 1';

export const CHEQUE_MATURITY_MIN_BUSINESS_DAYS = 3;
export const CHEQUE_MATURITY_MAX_BUSINESS_DAYS = 7;

export const PRICING_TIERS = [
  { minSoldRatio: 0.9, multiplierBump: 0.08 },
  { minSoldRatio: 0.7, multiplierBump: 0.05 },
  { minSoldRatio: 0.4, multiplierBump: 0.02 },
] as const;

export const SOLD_UNIT_STATUSES = ['CONTRACTED', 'DELIVERED'] as const;
