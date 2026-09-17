export type PaymentVoucherEntrySide = 'DEBIT' | 'CREDIT';

export type PaymentVoucherLine = {
  accountId: string;
  partyId?: string;
  partyKind?: 'CUSTOMER' | 'SUPPLIER';
  description?: string;
  amount: number;
  currencyCode?: string;
  exchangeRate?: number;
  costCenterId?: string;
  entrySide?: PaymentVoucherEntrySide;
  isTiedToInvoice?: boolean;
  invoiceId?: string | null;
  invoiceLabel?: string;
};

export function emptyPaymentLine(
  currencyCode: string,
  entrySide: PaymentVoucherEntrySide = 'DEBIT',
  costCenterId = '',
  exchangeRate = 1
): PaymentVoucherLine {
  return {
    accountId: '',
    description: '',
    amount: 0,
    currencyCode,
    exchangeRate,
    costCenterId,
    entrySide,
    isTiedToInvoice: false,
    invoiceId: null,
  };
}

export function lineBaseAmount(line: PaymentVoucherLine): number {
  const rate = Number(line.exchangeRate ?? 1);
  return (Number(line.amount) || 0) * (Number.isFinite(rate) && rate > 0 ? rate : 1);
}

export function splitPaymentLineTotals(lines: PaymentVoucherLine[]) {
  let debitTotal = 0;
  let creditTotal = 0;
  for (const line of lines) {
    const base = lineBaseAmount(line);
    if ((line.entrySide ?? 'DEBIT') === 'CREDIT') creditTotal += base;
    else debitTotal += base;
  }
  return { debitTotal, creditTotal, netCash: debitTotal - creditTotal };
}

/** Document-currency totals — overdraft must use these vs the FX-converted safe balance. */
export function splitPaymentLineForeignTotals(lines: PaymentVoucherLine[]) {
  let debitTotal = 0;
  let creditTotal = 0;
  for (const line of lines) {
    const amount = Number(line.amount) || 0;
    if ((line.entrySide ?? 'DEBIT') === 'CREDIT') creditTotal += amount;
    else debitTotal += amount;
  }
  return { debitTotal, creditTotal, netCash: debitTotal - creditTotal };
}

export function toCashPayloadLine(line: PaymentVoucherLine, headerCurrency: string) {
  const exchangeRate = Number(line.exchangeRate ?? 1) || 1;
  const amount = Number(line.amount);
  return {
    accountId: line.accountId,
    description: line.description,
    amount,
    currencyCode: line.currencyCode || headerCurrency,
    exchangeRate,
    baseAmount: amount * exchangeRate,
    costCenterId: line.costCenterId || undefined,
    entrySide: line.entrySide ?? 'DEBIT',
    isTiedToInvoice: Boolean(line.isTiedToInvoice && line.invoiceId),
    invoiceId: line.invoiceId || undefined,
  };
}
