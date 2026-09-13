import { Worker, type Job } from 'bullmq';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { workerRedisConnection } from '../../../workers/redis-connection';
import { emitAutomationEvent } from '../events/notification-bus';
import { claimIdempotencyKey } from '../redis/job-idempotency';
import { dispatchInventoryWebhook } from '../events/webhook-dispatcher';
import { AUTOMATION_JOB_NAMES, AUTOMATION_QUEUE_NAMES } from '../types/automation-jobs.types';
import type { UnitCancellationReleasedJobData } from '../types/automation-jobs.types';

export async function processUnitCancellationReleasedJob(job: Job<UnitCancellationReleasedJobData>) {
  const { companyId, contractId, settlementId, propertyUnitId, legacyUnitId } = job.data;

  if (propertyUnitId) {
    await prisma.propertyUnit.updateMany({
      where: { id: propertyUnitId, phase: { project: { companyId } } },
      data: { status: 'AVAILABLE' },
    });
  }

  await prisma.realEstateUnit.updateMany({
    where: { id: legacyUnitId, building: { project: { companyId } } },
    data: { status: 'AVAILABLE' },
  });

  const reservations = await prisma.realEstateReservation.updateMany({
    where: {
      companyId,
      unitId: legacyUnitId,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: 'UNIT_CANCELLATION_RELEASED',
    },
  });

  const payload = {
    contractId,
    settlementId,
    propertyUnitId,
    legacyUnitId,
    reservationLocksPurged: reservations.count,
    unitStatus: 'AVAILABLE',
  };

  const claimed = await claimIdempotencyKey(
    `automation:idempotency:unit-cancel:${settlementId}`,
    7 * 24 * 3600
  );
  if (claimed) {
    await emitAutomationEvent({
      companyId,
      event: 'UNIT_CANCELLATION_RELEASED',
      type: 'UNIT_RELEASED',
      title: 'وحدة عقارية أُفرجت للبيع',
      message: `Contract ${contractId} was forfeited. Unit is AVAILABLE again (${reservations.count} reservation lock(s) cancelled).`,
      linkUrl: '/real-estate/units',
      subjectType: 'UnitCancellationSettlement',
      subjectId: settlementId,
      metadata: payload,
    });
  }

  await dispatchInventoryWebhook({
    companyId,
    event: 'UNIT_CANCELLATION_RELEASED',
    payload,
  });

  logger.info({ jobId: job.id, ...payload }, 'Unit cancellation release broadcast');
  return payload;
}

export function createUnitCancellationReleasedWorker(): Worker<UnitCancellationReleasedJobData> {
  const worker = new Worker<UnitCancellationReleasedJobData>(
    AUTOMATION_QUEUE_NAMES.cancellations,
    async (job) => {
      if (job.name !== AUTOMATION_JOB_NAMES.unitCancellation) return;
      return processUnitCancellationReleasedJob(job);
    },
    { connection: workerRedisConnection }
  );
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'UnitCancellationReleasedWorker failed');
  });
  return worker;
}
