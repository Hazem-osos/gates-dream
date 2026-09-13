export type PaymentVoucherEntrySide = 'DEBIT' | 'CREDIT';
export type ReceiptVoucherEntrySide = 'CREDIT' | 'DEBIT';

export interface PaymentVoucherLineDto {
  accountId: string;
  amount: number;
  currencyId?: string;
  currencyCode?: string;
  exchangeRate?: number;
  baseAmount?: number;
  isTiedToInvoice?: boolean;
  invoiceId?: string | null;
  costCenterId?: string | null;
  description?: string | null;
  entrySide?: PaymentVoucherEntrySide;
}

export interface ReceiptVoucherLineDto {
  accountId: string;
  amount: number;
  currencyId?: string;
  currencyCode?: string;
  exchangeRate?: number;
  baseAmount?: number;
  isTiedToInvoice?: boolean;
  invoiceId?: string | null;
  costCenterId?: string | null;
  description?: string | null;
  entrySide?: ReceiptVoucherEntrySide;
}

export interface CreatePaymentVoucherDto {
  safeId: string;
  paymentOrderCode?: string;
  paymentOrderNumber?: string;
  sourceOrderId?: string;
  date: Date | string;
  hijriDate?: string;
  lines: PaymentVoucherLineDto[];
  notes?: string;
  additionalSettings?: Record<string, unknown>;
}

export interface CreateReceiptVoucherDto {
  safeId: string;
  receiptOrderCode?: string;
  receiptOrderNumber?: string;
  sourceOrderId?: string;
  date: Date | string;
  hijriDate?: string;
  lines: ReceiptVoucherLineDto[];
  notes?: string;
  additionalSettings?: Record<string, unknown>;
}

export function lineBaseAmount(line: {
  amount: number;
  exchangeRate?: number | null;
}): number {
  const rate = Number(line.exchangeRate ?? 1);
  return Number(line.amount) * (Number.isFinite(rate) && rate > 0 ? rate : 1);
}

export function splitVoucherLineTotals(
  lines: { amount: number; exchangeRate?: number | null; entrySide?: string }[],
  kind: 'PAYMENT' | 'RECEIPT' = 'PAYMENT'
) {
  let debitTotal = 0;
  let creditTotal = 0;
  for (const line of lines) {
    const base = lineBaseAmount(line);
    const defaultSide = kind === 'RECEIPT' ? 'CREDIT' : 'DEBIT';
    if ((line.entrySide ?? defaultSide) === 'CREDIT') creditTotal += base;
    else debitTotal += base;
  }
  return {
    debitTotal,
    creditTotal,
    netCash: kind === 'RECEIPT' ? creditTotal - debitTotal : debitTotal - creditTotal,
  };
}
