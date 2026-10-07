import { isRedisEnabledFlag } from '../../../../workers/redis-connection';
import { hcmLeaveAccrualQueue } from '../../../../workers/queues/hcm-leave-accrual.queue';
import { leaveAccrualService } from './leave-accrual.service';

export async function enqueueLeaveAccrual(
  companyId: string,
  year: number,
  month: number,
  requestedBy?: string
) {
  const periodKey = `${year}-${String(month).padStart(2, '0')}`;
  if (isRedisEnabledFlag()) {
    const jobId = `leave-accrual:${companyId}:${periodKey}`;
    const job = await hcmLeaveAccrualQueue.add(
      'monthly-accrual',
      { companyId, year, month, requestedBy },
      { jobId }
    );
    return { mode: 'queued' as const, jobId: job.id, enqueued: true };
  }
  const result = await leaveAccrualService.runMonthlyAccrual(companyId, year, month);
  return { mode: 'sync' as const, enqueued: false, result };
}

/** Direct path for tests and small ops. */
export async function runLeaveAccrualSync(companyId: string, year: number, month: number) {
  return leaveAccrualService.runMonthlyAccrual(companyId, year, month);
}
