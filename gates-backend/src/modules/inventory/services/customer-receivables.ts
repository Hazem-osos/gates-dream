export type InvoiceReceivableSlot = 'prior' | 'current' | 'd30' | 'd60' | 'd90' | 'older';

function ageBucket(due: Date, asOf: Date): Exclude<InvoiceReceivableSlot, 'prior'> {
  const days = Math.floor((asOf.getTime() - due.getTime()) / 86400000);
  if (!Number.isFinite(days) || days <= 0) return 'current';
  if (days <= 30) return 'd30';
  if (days <= 60) return 'd60';
  if (days <= 90) return 'd90';
  return 'older';
}

/**
 * سابق أو متأخرات: due before the report start.
 * With no start date, anything older than 90 days is prior.
 * Amounts due on or after the start stay in the 30/60/90/أكبر buckets, or لم تستحق.
 */
export function classifyReceivableInvoice(
  dueDate: Date | string | null | undefined,
  asOf: Date,
  fromDate?: Date | string | null,
): InvoiceReceivableSlot {
  const due = dueDate ? new Date(dueDate) : asOf;
  const start = fromDate ? new Date(fromDate) : null;
  if (start && Number.isFinite(start.getTime()) && due.getTime() < start.getTime()) return 'prior';
  const bucket = ageBucket(due, asOf);
  if (!start && bucket === 'older') return 'prior';
  return bucket;
}
