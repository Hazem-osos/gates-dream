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
export function splitPartyAdjustments(
  rows: InvoiceAdjustmentCalcInput[],
  baseSubtotal: number,
  invoiceExchangeRate = 1
): { additions: number; deductions: number } {
  let additions = 0;
  let deductions = 0;
  for (const row of rows) {
    if (String(row.offsetAccountId ?? '').trim()) continue;
    const amount = computeAdjustmentInvoiceAmount(row, baseSubtotal, invoiceExchangeRate);
    if (row.type === 'ADDITION') additions += amount;
    else deductions += amount;
  }
  return { additions: roundTo4(additions), deductions: roundTo4(deductions) };
}

/**
 * Net party extras as extra invoice discount: deductions minus additions.
 * A 100 discount and a 20 addition become 80. Additions are not other fees.
 */
export function partyExtrasAsExtraDiscount(additions: number, deductions: number): number {
  return roundTo4((Number(deductions) || 0) - (Number(additions) || 0));
}

/** Party-facing extras only — rows with offsetAccountId stay off AR/AP. */
export function sumPartyAdjustments(
  rows: InvoiceAdjustmentCalcInput[],
  baseSubtotal: number,
  invoiceExchangeRate = 1
): number {
  const split = splitPartyAdjustments(rows, baseSubtotal, invoiceExchangeRate);
  return roundTo4(split.additions - split.deductions);
}
