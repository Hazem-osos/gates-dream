/**
 * Scheduled/time-based event (Task 4): "sales.invoice.overdue" is not a
 * live transaction — GATES has no domain boundary that fires the instant
 * an invoice becomes overdue. Instead, once per day (UTC) this scans
 * POSTED, not-fully-paid SALE invoices whose dueDate (falling back to
 * `date` when dueDate is null, matching Invoice.dueDate's own documented
 * legacy-aging fallback) is in the past, and emits one
 * `sales.invoice.overdue` domain event per invoice per calendar day.
 */
import type { Job } from 'bullmq';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { emitDomainEvent } from '../events/automation-event-bus.service';
import { claimIdempotencyKey, salesInvoiceOverdueIdempotencyKey } from '../redis/job-idempotency';
import type { SalesInvoiceOverdueScanJobData } from '../types/automation-jobs.types';
import { utcDateKey } from '../utils/job-ids';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function processSalesInvoiceOverdueScanJob(
  job: Job<SalesInvoiceOverdueScanJobData>
): Promise<{ scanned: number; emitted: number }> {
  const asOf = job.data.asOfDate ? new Date(job.data.asOfDate) : new Date();
  const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const dateKey = utcDateKey(today);

  const invoices = await prisma.invoice.findMany({
    where: {
      invoiceKind: 'SALE',
      workflowStatus: 'POSTED',
      paymentStatus: { not: 'PAID' },
      OR: [{ dueDate: { lt: today } }, { dueDate: null, date: { lt: today } }],
    },
    select: {
      id: true,
      companyId: true,
      invoiceNumber: true,
      customerId: true,
      dueDate: true,
      date: true,
      remainingAmount: true,
    },
  });

  let emitted = 0;
  for (const invoice of invoices) {
    const effectiveDueDate = invoice.dueDate ?? invoice.date;
    const daysOverdue = Math.floor((today.getTime() - effectiveDueDate.getTime()) / MS_PER_DAY);
    if (daysOverdue <= 0) continue;

    const claimed = await claimIdempotencyKey(
      salesInvoiceOverdueIdempotencyKey(invoice.id, dateKey)
    );
    if (!claimed) continue;

    await emitDomainEvent({
      companyId: invoice.companyId,
      eventType: 'sales.invoice.overdue',
      // Stable per invoice+day — safe to call more than once for the same day.
      eventId: `sales-invoice-overdue:${invoice.id}:${dateKey}`,
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber ?? null,
        customerId: invoice.customerId ?? null,
        daysOverdue,
        remainingAmount: invoice.remainingAmount.toNumber(),
      },
    });
    emitted += 1;
  }

  const summary = { scanned: invoices.length, emitted };
  logger.info({ jobId: job.id, dateKey, ...summary }, 'Sales invoice overdue scan finished');
  return summary;
}
