import { Worker, type Job } from 'bullmq';
import { logger } from '../../shared/logger';
import { workerConsumerConnection } from '../redis-connection';
import { ASYNC_QUEUE_NAMES } from '../queue-manager';
import type { ReportExportJobData } from '../jobs/async-job.types';
import { notifyJobComplete } from '../lib/job-notify';
import { processReportJob } from './reports.processor';
import type { ReportJobData } from '../queues/reports.queue';

export async function processReportExportJob(job: Job<ReportExportJobData>) {
  const result = await processReportJob(job as unknown as Job<ReportJobData>);
  await notifyJobComplete({
    companyId: job.data.companyId,
    userId: job.data.userId,
    title: 'Excel export ready',
    message: `${job.data.reportName} is ready to download.`,
    linkUrl: result.downloadUrl,
    category: 'EXPORT',
  });
  return result;
}

export function createReportExportWorker(): Worker<ReportExportJobData> {
  const worker = new Worker<ReportExportJobData>(
    ASYNC_QUEUE_NAMES.REPORT_EXPORT,
    async (job) => processReportExportJob(job),
    { connection: workerConsumerConnection, concurrency: 2 }
  );
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'report-export job failed');
  });
  return worker;
}
