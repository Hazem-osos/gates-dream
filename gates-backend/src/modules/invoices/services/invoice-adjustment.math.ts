import { roundTo4 } from '../../../shared/utils/decimal-round';

export type InvoiceAdjustmentKind = 'ADDITION' | 'DEDUCTION';
export type InvoiceAdjustmentCalc = 'FIXED' | 'PERCENTAGE';

export type InvoiceAdjustmentCalcInput = {
  type: InvoiceAdjustmentKind;
  calcType: InvoiceAdjustmentCalc;
  rate?: number | null;
  amount: number;
  exchangeRate?: number | null;
  offsetAccountId?: string | null;
};

export function computeAdjustmentInvoiceAmount(
  row: InvoiceAdjustmentCalcInput,
  baseSubtotal: number,
  invoiceExchangeRate = 1
): number {
  if (row.calcType === 'PERCENTAGE') {
    return roundTo4(Math.max(0, (Math.max(baseSubtotal, 0) * (Number(row.rate) || 0)) / 100));
  }
  const local = Math.max(0, Number(row.amount) || 0);
  const rowFx = Number(row.exchangeRate) > 0 ? Number(row.exchangeRate) : 1;
  const invFx = Number(invoiceExchangeRate) > 0 ? Number(invoiceExchangeRate) : 1;
  return roundTo4(local * (rowFx / invFx));
}

/** Party-facing extras only — rows with offsetAccountId stay off AR/AP. */
export function sumPartyAdjustments(
  rows: InvoiceAdjustmentCalcInput[],
  baseSubtotal: number,
  invoiceExchangeRate = 1
): number {
  let net = 0;
  for (const row of rows) {
    if (String(row.offsetAccountId ?? '').trim()) continue;
    const amount = computeAdjustmentInvoiceAmount(row, baseSubtotal, invoiceExchangeRate);
    net += row.type === 'ADDITION' ? amount : -amount;
  }
  return roundTo4(net);
}
