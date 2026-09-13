export function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function utcIsoWeekKey(date: Date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function dailyLateFeeJobId(companyId: string, dateKey: string): string {
  return `daily-late-fee-${companyId}-${dateKey}`;
}

export function chequeMaturityJobId(dateKey: string): string {
  return `cheque-maturity-${dateKey}`;
}

export function dynamicPricingJobId(companyId: string, weekKey: string): string {
  return `dynamic-pricing-${companyId}-${weekKey}`;
}

export function chequeBouncedJobId(chequeId: string): string {
  return `cheque-bounced-${chequeId}`;
}

export function subcontractWorkflowJobId(invoiceId: string, toStatus: string): string {
  return `subcontract-invoice-${invoiceId}-${toStatus}`;
}

export function unitCancellationJobId(settlementId: string): string {
  return `unit-cancellation-${settlementId}`;
}
