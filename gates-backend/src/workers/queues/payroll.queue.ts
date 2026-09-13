import { Queue } from 'bullmq';
import { logger } from '../../shared/logger';
import { workerRedisConnection } from '../redis-connection';

/**
 * Payroll Queue
 * Handles payroll calculation jobs
 */

export interface PayrollJobData {
  companyId: string;
  period: string; // e.g., "2025-01"
  userId: string;
}

export const createPayrollQueue = (): Queue<PayrollJobData> => {
  return new Queue<PayrollJobData>('payroll', {
    connection: workerRedisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 86400, // Keep completed jobs for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 604800, // Keep failed jobs for 7 days
      },
    },
  });
};

export const payrollQueue = createPayrollQueue();

logger.info('Payroll queue initialized');
