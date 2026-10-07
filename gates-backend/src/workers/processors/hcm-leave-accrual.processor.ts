import { Worker, type Job } from 'bullmq';
import { workerConsumerConnection } from '../redis-connection';
import {
  HCM_LEAVE_ACCRUAL_QUEUE_NAME,
  type HcmLeaveAccrualJobData,
} from '../queues/hcm-leave-accrual.queue';
import { leaveAccrualService } from '../../modules/hr/services/leave/leave-accrual.service';
import { logger } from '../../shared/logger';

export function createHcmLeaveAccrualWorker(): Worker<HcmLeaveAccrualJobData> {
  return new Worker<HcmLeaveAccrualJobData>(
    HCM_LEAVE_ACCRUAL_QUEUE_NAME,
    async (job: Job<HcmLeaveAccrualJobData>) => {
      const { companyId, year, month } = job.data;
      const result = await leaveAccrualService.runMonthlyAccrual(companyId, year, month);
      logger.info({ jobId: job.id, companyId, year, month, result }, 'HCM leave accrual job completed');
      return result;
    },
    { connection: workerConsumerConnection }
  );
}
