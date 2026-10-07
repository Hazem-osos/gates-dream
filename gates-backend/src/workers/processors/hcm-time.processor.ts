import { Worker, type Job } from 'bullmq';
import { workerConsumerConnection } from '../redis-connection';
import { HCM_TIME_QUEUE_NAME, type HcmTimeRecalcJobData } from '../queues/hcm-time.queue';
import { hcmTimeBatchService } from '../../modules/hr/services/time/hcm-time-batch.service';
import { logger } from '../../shared/logger';

export function createHcmTimeWorker(): Worker<HcmTimeRecalcJobData> {
  const worker = new Worker<HcmTimeRecalcJobData>(
    HCM_TIME_QUEUE_NAME,
    async (job: Job<HcmTimeRecalcJobData>) => {
      const { companyId, scope } = job.data;
      const result = await hcmTimeBatchService.recalculateScope(companyId, scope);
      logger.info({ jobId: job.id, companyId, result }, 'HCM time batch job completed');
      return result;
    },
    { connection: workerConsumerConnection }
  );
  return worker;
}
