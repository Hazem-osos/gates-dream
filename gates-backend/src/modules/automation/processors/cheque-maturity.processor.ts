import type { Job } from 'bullmq';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { money } from '../../real-estate/utils/money-decimal';
import {
  CHEQUE_MATURITY_MAX_BUSINESS_DAYS,
  CHEQUE_MATURITY_MIN_BUSINESS_DAYS,
} from '../constants';
import { emitAutomationEvent } from '../events/notification-bus';
import { claimIdempotencyKey, chequeMaturityIdempotencyKey } from '../redis/job-idempotency';
import type { ChequeDueForDepositItem, ChequeMaturityJobData } from '../types/automation-jobs.types';
import { addUtcBusinessDays, startOfUtcDay, utcBusinessDaysBetween } from '../utils/business-days';
import { utcDateKey } from '../utils/job-ids';

export async function processChequeMaturityJob(job: Job<ChequeMaturityJobData>) {
  const asOf = job.data.asOfDate ? new Date(job.data.asOfDate) : new Date();
  const today = startOfUtcDay(asOf);
  const windowStart = addUtcBusinessDays(today, CHEQUE_MATURITY_MIN_BUSINESS_DAYS);
  const windowEnd = addUtcBusinessDays(today, CHEQUE_MATURITY_MAX_BUSINESS_DAYS);
  const dateKey = utcDateKey(today);

  const cheques = await prisma.postDatedCheque.findMany({
    where: {
      status: 'UNDER_SAFE_CUSTODY',
      chequeDate: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      companyId: true,
      chequeNumber: true,
      bankName: true,
      drawerName: true,
      chequeDate: true,
      amount: true,
      unitContractId: true,
    },
  });

  const grouped = new Map<string, ChequeDueForDepositItem[]>();
  for (const cheque of cheques) {
    const businessDaysUntilDue = utcBusinessDaysBetween(today, cheque.chequeDate);
    if (
      businessDaysUntilDue < CHEQUE_MATURITY_MIN_BUSINESS_DAYS ||
      businessDaysUntilDue > CHEQUE_MATURITY_MAX_BUSINESS_DAYS
    ) {
      continue;
    }
    const item: ChequeDueForDepositItem = {
      chequeId: cheque.id,
      chequeNumber: cheque.chequeNumber,
      bankName: cheque.bankName,
      drawerName: cheque.drawerName,
      chequeDate: cheque.chequeDate.toISOString(),
      amount: money(cheque.amount).toFixed(4),
      unitContractId: cheque.unitContractId,
      businessDaysUntilDue,
    };
    const list = grouped.get(cheque.companyId) ?? [];
    list.push(item);
    grouped.set(cheque.companyId, list);
  }

  let companiesNotified = 0;
  for (const [companyId, items] of grouped) {
    const claimed = await claimIdempotencyKey(chequeMaturityIdempotencyKey(companyId, dateKey));
    if (!claimed) continue;

    await emitAutomationEvent({
      companyId,
      event: 'NOTIFY_CHEQUES_DUE_FOR_DEPOSIT',
      type: 'CHEQUE_DUE',
      title: `شيكات مستحقة للإيداع خلال ${CHEQUE_MATURITY_MIN_BUSINESS_DAYS}–${CHEQUE_MATURITY_MAX_BUSINESS_DAYS} أيام عمل`,
      message: `${items.length} post-dated cheque(s) under safe custody mature between ${windowStart.toISOString().slice(0, 10)} and ${windowEnd.toISOString().slice(0, 10)}.`,
      linkUrl: '/treasury/securities-receipt',
      subjectType: 'PostDatedCheque',
      subjectId: items[0]?.chequeId ?? companyId,
      severity: 'warn',
      metadata: { asOfDate: dateKey, cheques: items },
    });
    companiesNotified += 1;
  }

  const summary = {
    asOfDate: dateKey,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    chequesMatched: cheques.length,
    companiesNotified,
  };
  logger.info({ jobId: job.id, ...summary }, 'Cheque maturity reminder finished');
  return summary;
}
