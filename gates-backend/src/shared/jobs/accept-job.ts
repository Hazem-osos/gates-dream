import type { Job, JobsOptions } from 'bullmq';
import type { Response } from 'express';
import { logger } from '../logger';
import { enqueueJob, type AsyncQueueName } from '../../workers/queue-manager';
import { requireRedisEnabled } from './require-redis';

export function respondAcceptedJob(
  res: Response,
  job: Job,
  message = 'Job queued'
): void {
  res.status(202).json({
    status: 'accepted',
    message,
    jobId: job.id,
    statusUrl: `/api/v1/jobs/${job.id}`,
  });
}

export async function enqueueAcceptedJob<T extends { companyId: string }>(
  res: Response,
  queueName: AsyncQueueName,
  jobName: string,
  data: T,
  message: string,
  options?: JobsOptions
): Promise<boolean> {
  if (!requireRedisEnabled(res)) return false;
  try {
    const job = await enqueueJob(queueName, jobName, data, options);
    respondAcceptedJob(res, job, message);
    return true;
  } catch (error) {
    logger.error({ error, queueName, jobName }, 'Failed to enqueue background job');
    res.status(500).json({
      status: 'error',
      message: 'Failed to enqueue background job',
    });
    return false;
  }
}
