import { apiClient } from '@/lib/api/client';
import type { PaymentSplitLine } from '@/lib/invoices/payment-split.types';

export async function postInvoiceSettlementSplits(
  invoiceId: string,
  splits: PaymentSplitLine[]
) {
  const paymentSplits = splits.filter(
    (line) => line.type !== 'ON_ACCOUNT' && Number(line.amount) > 0
  );
  if (paymentSplits.length === 0) {
    throw new Error('حدد مبلغ نقدي أو بنكي أو شيك');
  }
  return apiClient.post(`/invoices/${invoiceId}/settlements/split`, {
    date: new Date().toISOString(),
    paymentSplits,
  });
}
