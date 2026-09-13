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

export type LandedCostExtras = {
  freightAmount?: number;
  supplierDiscountAmount?: number;
};

export type LandedCostBreakdown = {
  baseUnitPrice: number;
  freightShare: number;
  freightPercentOfInvoice: number;
  supplierDiscountShare: number;
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
  allLines: LandedCostLineInput[],
  extras: LandedCostExtras = {},
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
  const pricedQty = Math.max(parseDecimal(line.quantity), qty, 0);
  const unitPrice = parseDecimal(line.unitPrice);
  const lineValue = merchandiseValue(line, opts?.pricingCalculationBasis);
  const invoiceValue = allLines.reduce(
    (sum, row) => sum + merchandiseValue(row, opts?.pricingCalculationBasis),
    0
  );
  const share = invoiceValue > 0 ? lineValue / invoiceValue : 0;
  const freight = Math.max(parseDecimal(extras.freightAmount), 0);
  const supplierDiscount = Math.max(parseDecimal(extras.supplierDiscountAmount), 0);
  const freightShareTotal = roundTo4(freight * share);
  const discountShareTotal = roundTo4(supplierDiscount * share);
  const divisor = pricedQty > 0 ? pricedQty : 1;
  const freightShare = pricedQty > 0 ? roundTo4(freightShareTotal / divisor) : 0;
  const supplierDiscountShare = pricedQty > 0 ? roundTo4(discountShareTotal / divisor) : 0;
  const landedUnitCost = roundTo4(unitPrice + freightShare - supplierDiscountShare);

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
    freightShare,
    freightPercentOfInvoice: roundTo4(share * 100),
    supplierDiscountShare,
    landedUnitCost,
    lineMerchandiseValue: roundTo4(lineValue),
    invoiceMerchandiseValue: roundTo4(invoiceValue),
    previousAverageCost,
    projectedAverageCost,
  };
}
