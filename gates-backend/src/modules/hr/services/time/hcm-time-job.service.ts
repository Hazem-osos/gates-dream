import { createHash } from 'crypto';
import { isRedisEnabledFlag } from '../../../../workers/redis-connection';
import { hcmTimeQueue, type HcmTimeRecalcJobData } from '../../../../workers/queues/hcm-time.queue';
import { hcmTimeBatchService, type BatchRecalcScope } from './hcm-time-batch.service';

export async function enqueueHcmTimeRecalc(companyId: string, scope: BatchRecalcScope, requestedBy?: string) {
  if (isRedisEnabledFlag()) {
    const jobId = createHash('sha256')
      .update(JSON.stringify({ companyId, scope }))
      .digest('hex')
      .slice(0, 32);
    const job = await hcmTimeQueue.add(
      'recalculate',
      { companyId, scope, requestedBy } satisfies HcmTimeRecalcJobData,
      { jobId }
    );
    return { mode: 'queued' as const, jobId: job.id };
  }
  const result = await hcmTimeBatchService.recalculateScope(companyId, scope);
  return { mode: 'sync' as const, result };
}
