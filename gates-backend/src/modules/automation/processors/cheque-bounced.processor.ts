import { Worker, type Job } from 'bullmq';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { workerRedisConnection } from '../../../workers/redis-connection';
import { lateFeeCalculationService } from '../../real-estate/services/late-fee-calculation.service';
import { money } from '../../real-estate/utils/money-decimal';
import { emitAutomationEvent } from '../events/notification-bus';
import { claimIdempotencyKey } from '../redis/job-idempotency';
import { AUTOMATION_JOB_NAMES, AUTOMATION_QUEUE_NAMES } from '../types/automation-jobs.types';
import type { ChequeBouncedJobData } from '../types/automation-jobs.types';

export async function processChequeBouncedJob(job: Job<ChequeBouncedJobData>) {
  const { companyId, chequeId, unitInstallmentId, bounceReason, amount } = job.data;

  const cheque = await prisma.postDatedCheque.findFirst({
    where: { id: chequeId, companyId },
    include: {
      contract: {
        include: {
          customer: {
            select: { id: true, arabicName: true, englishName: true, code: true, mobile: true },
          },
        },
      },
    },
  });
  if (!cheque) {
    throw new Error(`Bounced cheque ${chequeId} not found for company ${companyId}`);
  }

  let installment = null;
  const installmentId = unitInstallmentId ?? cheque.unitInstallmentId;
  if (installmentId) {
    installment = await prisma.unitInstallment.findFirst({
      where: { id: installmentId, contract: { companyId } },
    });
    if (installment && money(installment.balance).gt(0)) {
      installment = await lateFeeCalculationService.applyLateFeeToInstallmentInTx(
        prisma,
        companyId,
        installment.id,
        new Date()
      );
    }
  }

  const customer = cheque.contract.customer;
  const claimed = await claimIdempotencyKey(`automation:idempotency:cheque-bounced:${cheque.id}`, 7 * 24 * 3600);
  if (!claimed) {
    return {
      chequeId: cheque.id,
      installmentId: installment?.id ?? null,
      installmentStatus: installment?.status ?? null,
      skippedNotification: true,
    };
  }

  await emitAutomationEvent({
    companyId,
    event: 'ALERT_BOUNCED_CHEQUE',
    type: 'ALERT_BOUNCED_CHEQUE',
    title: `شيك مرتد ${cheque.chequeNumber}`,
    message: [
      `Customer: ${customer.arabicName}`,
      `Amount: ${money(cheque.amount).toFixed(4)}`,
      `Bank: ${cheque.bankName}`,
      `Reason: ${bounceReason}`,
    ].join(' | '),
    linkUrl: '/treasury/securities-receipt',
    subjectType: 'PostDatedCheque',
    subjectId: cheque.id,
    severity: 'error',
    metadata: {
      chequeId: cheque.id,
      chequeNumber: cheque.chequeNumber,
      amount: money(cheque.amount).toFixed(4),
      jobAmount: amount,
      bounceReason,
      customerId: customer.id,
      customerName: customer.arabicName,
      customerCode: customer.code,
      customerMobile: customer.mobile,
      unitContractId: cheque.unitContractId,
      unitInstallmentId: installment?.id ?? null,
      installmentStatus: installment?.status ?? null,
      accumulatedLateFee: installment ? money(installment.accumulatedLateFee).toFixed(4) : null,
    },
  });

  return {
    chequeId: cheque.id,
    installmentId: installment?.id ?? null,
    installmentStatus: installment?.status ?? null,
  };
}

export function createChequeBouncedWorker(): Worker<ChequeBouncedJobData> {
  const worker = new Worker<ChequeBouncedJobData>(
    AUTOMATION_QUEUE_NAMES.cheques,
    async (job) => {
      if (job.name !== AUTOMATION_JOB_NAMES.chequeBounced) return;
      return processChequeBouncedJob(job);
    },
    { connection: workerRedisConnection }
  );
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'ChequeBouncedWorker failed');
  });
  return worker;
}
