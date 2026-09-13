import { parseDecimal, roundTo4 } from '../money/parseDecimal';
import {
  resolveDiscountValue,
  resolveLineDiscountAmount,
  type DiscountType,
} from './discount-type';
import {
  parsePricingCalculationBasis,
  resolvePricedQuantity,
  type PricingCalculationBasis,
} from './unit-conversion';

export type InvoiceRowCalcLine = {
  quantity?: number;
  baseQuantity?: number;
  unitPrice?: number;
  discount?: number;
  discountValue?: number;
  discountType?: DiscountType | string;
  taxRate?: number;
};

export type InvoiceRowTotals = {
  pricedQuantity: number;
  lineTotal: number;
  lineDiscount: number;
  lineAfterDiscount: number;
  lineTax: number;
  rowSubtotal: number;
};

export function calculateRowTotals(
  line: InvoiceRowCalcLine,
  opts?: { pricingCalculationBasis?: PricingCalculationBasis | string }
): InvoiceRowTotals {
  const basis = parsePricingCalculationBasis(opts?.pricingCalculationBasis);
  const pricedQuantity = resolvePricedQuantity(
    parseDecimal(line.quantity),
    parseDecimal(line.baseQuantity),
    basis
  );
  const price = parseDecimal(line.unitPrice);
  const lineTotal = pricedQuantity * price;
  const lineDiscount = resolveLineDiscountAmount(
    lineTotal,
    line.discountType,
    resolveDiscountValue(line)
  );
  const lineAfterDiscount = lineTotal - lineDiscount;
  const taxPercent = parseDecimal(line.taxRate);
  const lineTax = taxPercent ? (lineAfterDiscount * taxPercent) / 100 : 0;
  return {
    pricedQuantity,
    lineTotal: roundTo4(lineTotal),
    lineDiscount: roundTo4(lineDiscount),
    lineAfterDiscount: roundTo4(lineAfterDiscount),
    lineTax: roundTo4(lineTax),
    rowSubtotal: roundTo4(lineAfterDiscount + lineTax),
  };
}
