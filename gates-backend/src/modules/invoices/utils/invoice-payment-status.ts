import { amountsEqualAt4 } from '../../../shared/utils/decimal-round';

export type InvoicePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export function deriveInvoicePaymentStatus(
  paidAmount: number,
  netAmount: number
): InvoicePaymentStatus {
  if (paidAmount <= 0.0001) return 'UNPAID';
  if (paidAmount >= netAmount - 0.0001 || amountsEqualAt4(paidAmount, netAmount)) return 'PAID';
  return 'PARTIALLY_PAID';
}
