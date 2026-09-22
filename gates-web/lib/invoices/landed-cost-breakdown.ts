import { parseDecimal, roundTo4 } from '@/lib/money/parseDecimal';
import { calculateRowTotals } from './calculateInvoiceRowTotals';
import type { DiscountType } from './discount-type';
import type { PricingCalculationBasis } from './unit-conversion';

export type LandedCostLineInput = {
  quantity?: number;
  baseQuantity?: number;
  unitPrice?: number;
  discount?: number;
  discountValue?: number;
  discountType?: DiscountType | string;
};

export type LandedCostBreakdown = {
  baseUnitPrice: number;
  landedUnitCost: number;
  lineMerchandiseValue: number;
  invoiceMerchandiseValue: number;
  previousAverageCost?: number;
  projectedAverageCost?: number;
};

function merchandiseValue(
  line: LandedCostLineInput,
  basis?: PricingCalculationBasis | string
): number {
  return calculateRowTotals(line, { pricingCalculationBasis: basis }).lineAfterDiscount;
}

export function buildLandedCostBreakdown(
  line: LandedCostLineInput,
  _allLines: LandedCostLineInput[],
  opts?: {
    pricingCalculationBasis?: PricingCalculationBasis | string;
    previousAverageCost?: number;
    onHandQuantity?: number;
  }
): LandedCostBreakdown {
  const qty = Math.max(
    parseDecimal(line.baseQuantity) || parseDecimal(line.quantity),
    0
  );
  const unitPrice = parseDecimal(line.unitPrice);
  const lineValue = merchandiseValue(line, opts?.pricingCalculationBasis);
  const landedUnitCost = roundTo4(unitPrice);

  const previousAverageCost =
    opts?.previousAverageCost != null && Number.isFinite(opts.previousAverageCost)
      ? roundTo4(opts.previousAverageCost)
      : undefined;
  const onHand = Math.max(parseDecimal(opts?.onHandQuantity), 0);
  const projectedAverageCost =
    previousAverageCost != null && qty > 0
      ? roundTo4((previousAverageCost * onHand + landedUnitCost * qty) / (onHand + qty))
      : undefined;

  return {
    baseUnitPrice: roundTo4(unitPrice),
    landedUnitCost,
    lineMerchandiseValue: roundTo4(lineValue),
    invoiceMerchandiseValue: roundTo4(lineValue),
    previousAverageCost,
    projectedAverageCost,
  };
}
