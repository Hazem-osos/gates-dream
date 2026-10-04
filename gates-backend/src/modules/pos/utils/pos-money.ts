import { Decimal } from '@prisma/client/runtime/library';
import { computeLineAmounts } from '../../invoices/services/invoice-line-math';
import type { PosOrderLineInput } from '../types/pos.types';

/**
 * Header and line money columns on PosOrder are Decimal(15,2).
 * Half-up matches MySQL DECIMAL rounding for non-negative amounts.
 */
export function roundTo2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export type AuthoritativePosLine = PosOrderLineInput & {
  lineDiscount: number;
  taxAmount: number;
  lineTotal: number;
};

/**
 * Server totals for a POS order. Line math is `computeLineAmounts` (same as invoices).
 * Persisted money is then normalized to 2dp, which is the scale the columns actually store.
 * Tender checks must use `netAmount` from this result, not a 4dp preview.
 */
export function authoritativePosTotals(lines: PosOrderLineInput[]) {
  let totalAmount = 0;
  let discountAmount = 0;
  let taxAmount = 0;

  const computed: AuthoritativePosLine[] = lines.map((line) => {
    const math = computeLineAmounts(line);
    const gross = roundTo2(math.lineTotal);
    const lineDiscount = roundTo2(math.lineDiscount);
    const lineTax = roundTo2(math.lineTax);
    const afterDiscount = roundTo2(gross - lineDiscount);
    totalAmount = roundTo2(totalAmount + gross);
    discountAmount = roundTo2(discountAmount + lineDiscount);
    taxAmount = roundTo2(taxAmount + lineTax);
    return {
      ...line,
      lineTotal: afterDiscount,
      lineDiscount,
      taxAmount: lineTax,
    };
  });

  const netAmount = roundTo2(totalAmount - discountAmount + taxAmount);
  return {
    lines: computed,
    totalAmount,
    discountAmount,
    taxAmount,
    netAmount,
    merchandise: roundTo2(totalAmount - discountAmount),
  };
}
