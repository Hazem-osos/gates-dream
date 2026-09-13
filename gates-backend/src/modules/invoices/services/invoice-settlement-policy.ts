/**
 * Cheque statuses that mean the paper already left the portfolio / was
 * banked. `COLLECTED` is the Prisma enum for a bank-cleared cheque
 * (legacy rows stored `'CLEARED'` and are remapped by migrate).
 */
export const CHEQUE_STATUSES_BLOCKING_INVOICE_UNPOST = [
  'SENT_TO_BANK',
  'COLLECTED',
  'ENDORSED',
] as const;

export const INVOICE_UNPOST_BLOCKED_CHEQUE_MESSAGE =
  'لا يمكن إلغاء ترحيل فاتورة تم إيداع أو تحصيل شيكاتها بنكياً. يجب تسوية الشيكات بالبنك أولاً.';

export const INVOICE_DRAFT_SETTLEMENT_LOCK_MESSAGE =
  'لا يمكن تعديل كميات أو أسعار فاتورة لها تحصيلات قائمة. ألغِ التحصيلات أولاً.';

export const INVOICE_DELETE_SETTLEMENT_LOCK_MESSAGE =
  'Invoice has settlements — cancel it instead of deleting';

export function isChequeStatusBlockingInvoiceUnpost(status: string): boolean {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'CLEARED') return true;
  return (CHEQUE_STATUSES_BLOCKING_INVOICE_UNPOST as readonly string[]).includes(normalized);
}

export function shouldSkipInvoiceAutoSettle(
  activeAllocationCount: number,
  activeChequeCount: number
): boolean {
  return activeAllocationCount > 0 || activeChequeCount > 0;
}

export function invoiceHasUnclearedSettlementHistory(params: {
  remainingAmount: number;
  netAmount: number;
  activeAllocationCount: number;
  activeChequeCount: number;
}): boolean {
  const remainingEqualsNet =
    Math.abs(params.remainingAmount - params.netAmount) <= 0.0001;
  return (
    !remainingEqualsNet ||
    params.activeAllocationCount > 0 ||
    params.activeChequeCount > 0
  );
}

/** Hard delete is forbidden if any settlement row still points at the invoice. */
export function invoiceHasLinkedSettlementRecords(counts: {
  paymentAllocations: number;
  cashTransactions: number;
  cheques: number;
}): boolean {
  return (
    counts.paymentAllocations > 0 ||
    counts.cashTransactions > 0 ||
    counts.cheques > 0
  );
}
