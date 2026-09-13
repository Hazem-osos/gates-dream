import { Queue } from 'bullmq';
import { logger } from '../../shared/logger';
import { workerRedisConnection } from '../redis-connection';

/**
 * Reports Queue
 * Handles report generation jobs (PDF, Excel, etc.)
 */

export interface ReportJobData {
  companyId: string;
  reportType: 'pdf' | 'excel' | 'csv';
  reportName: string;
  filters: Record<string, any>;
  userId: string;
  email?: string; // Optional: email to send report
}

export const createReportsQueue = (): Queue<ReportJobData> => {
  return new Queue<ReportJobData>('reports', {
    connection: workerRedisConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 500,
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
  });
};

export const reportsQueue = createReportsQueue();

logger.info('Reports queue initialized');
