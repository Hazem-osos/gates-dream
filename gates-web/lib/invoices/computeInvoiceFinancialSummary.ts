import { parseDecimal, roundTo4 } from '../money/parseDecimal';
import { calculateRowTotals } from './calculateInvoiceRowTotals';
import type { DiscountType } from './discount-type';
import type { PricingCalculationBasis } from './unit-conversion';
import { lineWithholdingAmount } from './itemTracking';

/** Matches M5 `lineAmounts` / `calculateTotals` in invoice-m5.service.ts */
export type InvoiceSummaryLine = {
  quantity?: number;
  baseQuantity?: number;
  unitPrice?: number;
  /** Legacy alias — prefer `discountValue` + `discountType`. */
  discount?: number;
  discountValue?: number;
  discountType?: DiscountType | string;
  /** Sent to API as taxPercent */
  taxRate?: number;
  withholdingTaxRate?: number;
  withholdingTaxAmount?: number;
};

export type InvoiceFinancialSummary = {
  subtotalWithoutTax: number;
  taxAmount: number;
  developmentFeeRate: number | null;
  developmentFeeAmount: number;
  withholdingTaxAmount: number;
  additionsAndDiscounts: number;
  giftsTotal: number;
  netAmount: number;
};

export type DevelopmentFeeMode = 'percent' | 'fixed';

export function developmentFeeFormFromInvoice(invoice: {
  developmentFeeRate?: unknown;
  developmentFeeAmount?: unknown;
}): {
  developmentFeeEnabled: boolean;
  developmentFeeMode: DevelopmentFeeMode;
  developmentFeeRate: number;
  developmentFeeFixedAmount: number | undefined;
} {
  const rate = Number(invoice.developmentFeeRate ?? 0);
  const amount = Number(invoice.developmentFeeAmount ?? 0);
  if (Number.isFinite(rate) && rate > 0) {
    return {
      developmentFeeEnabled: true,
      developmentFeeMode: 'percent',
      developmentFeeRate: rate,
      developmentFeeFixedAmount: undefined,
    };
  }
  if (Number.isFinite(amount) && amount > 0) {
    return {
      developmentFeeEnabled: true,
      developmentFeeMode: 'fixed',
      developmentFeeRate: 1,
      developmentFeeFixedAmount: amount,
    };
  }
  return {
    developmentFeeEnabled: false,
    developmentFeeMode: 'percent',
    developmentFeeRate: 1,
    developmentFeeFixedAmount: undefined,
  };
}

// Wave 5 fix: this used to round every intermediate figure to 2dp
// (`Math.round(n * 100) / 100`), while the backend M5 line math
// (`invoice-line-math.ts#computeLineAmounts`) rounds at 4dp — the same
// precision the GL posts at. Rounding the preview to 2dp at every step could
// drift from what the server actually computes and returns after save.
// Compute at 4dp here; round to 2dp only when formatting for display.
const roundMoney = roundTo4;

function resolveDevelopmentFeePreview(
  netSubtotal: number,
  opts?: {
    developmentFeeEnabled?: boolean;
    developmentFeeMode?: DevelopmentFeeMode;
    developmentFeeRate?: number | null;
    developmentFeeFixedAmount?: number | null;
  }
): { rate: number | null; amount: number } {
  if (!opts?.developmentFeeEnabled) {
    return { rate: null, amount: 0 };
  }
  if (opts.developmentFeeMode === 'fixed') {
    return { rate: null, amount: roundMoney(Math.max(parseDecimal(opts.developmentFeeFixedAmount), 0)) };
  }
  const rate = parseDecimal(opts.developmentFeeRate);
  if (rate <= 0) {
    return { rate: rate === 0 ? 0 : null, amount: 0 };
  }
  return { rate, amount: roundMoney((Math.max(netSubtotal, 0) * rate) / 100) };
}

function lineAmounts(
  line: InvoiceSummaryLine,
  basis?: PricingCalculationBasis | string
) {
  const totals = calculateRowTotals(line, { pricingCalculationBasis: basis });
  return {
    lineTotal: totals.lineTotal,
    lineDiscount: totals.lineDiscount,
    lineAfterDiscount: totals.lineAfterDiscount,
    lineTax: totals.lineTax,
  };
}

export function computeLineSubtotalAfterDiscount(
  line: InvoiceSummaryLine,
  pricingCalculationBasis?: PricingCalculationBasis | string
): number {
  return roundMoney(lineAmounts(line, pricingCalculationBasis).lineAfterDiscount);
}

export function computeInvoiceGrossDiscount(
  lines: InvoiceSummaryLine[],
  pricingCalculationBasis?: PricingCalculationBasis | string
) {
  let gross = 0;
  let discount = 0;
  for (const line of lines) {
    const { lineTotal, lineDiscount } = lineAmounts(line, pricingCalculationBasis);
    gross += lineTotal;
    discount += lineDiscount;
  }
  return { gross: roundMoney(gross), commercialDiscount: roundMoney(discount) };
}

export function computeInvoiceFinancialSummary(
  lines: InvoiceSummaryLine[],
  opts?: {
    applyTax?: boolean;
    withholdingTaxAmount?: number;
    additionsAndDiscounts?: number;
    giftsTotal?: number;
    developmentFeeEnabled?: boolean;
    developmentFeeMode?: DevelopmentFeeMode;
    developmentFeeRate?: number | null;
    developmentFeeFixedAmount?: number | null;
    pricingCalculationBasis?: PricingCalculationBasis | string;
  }
): InvoiceFinancialSummary {
  const applyTax = opts?.applyTax !== false;
  let totalAmount = 0;
  let discountAmount = 0;
  let taxAmount = 0;

  for (const line of lines) {
    const qty = parseDecimal(line.quantity);
    const price = parseDecimal(line.unitPrice);
    if (qty <= 0 && price <= 0) continue;
    const { lineTotal, lineDiscount, lineTax } = lineAmounts(line, opts?.pricingCalculationBasis);
    totalAmount += lineTotal;
    discountAmount += lineDiscount;
    taxAmount += lineTax;
  }

  if (!applyTax) taxAmount = 0;

  const subtotalWithoutTax = totalAmount - discountAmount;
  const fee = resolveDevelopmentFeePreview(subtotalWithoutTax, opts);
  const netBeforeWht = subtotalWithoutTax + taxAmount + fee.amount;
  const lineWht = lines.reduce((sum, line) => {
    const { lineAfterDiscount } = lineAmounts(line, opts?.pricingCalculationBasis);
    return (
      sum +
      lineWithholdingAmount({
        lineAfterDiscount,
        withholdingTaxRate: line.withholdingTaxRate,
        withholdingTaxAmount: line.withholdingTaxAmount,
      })
    );
  }, 0);
  const headerWht = parseDecimal(opts?.withholdingTaxAmount);
  const withholdingTaxAmount = lineWht > 0 ? lineWht : headerWht;
  const additionsAndDiscounts = parseDecimal(opts?.additionsAndDiscounts);
  const giftsTotal = parseDecimal(opts?.giftsTotal);
  const netAmount = netBeforeWht - withholdingTaxAmount + additionsAndDiscounts - giftsTotal;

  return {
    subtotalWithoutTax: roundMoney(subtotalWithoutTax),
    taxAmount: roundMoney(taxAmount),
    developmentFeeRate: fee.rate,
    developmentFeeAmount: fee.amount,
    withholdingTaxAmount: roundMoney(withholdingTaxAmount),
    additionsAndDiscounts: roundMoney(additionsAndDiscounts),
    giftsTotal: roundMoney(giftsTotal),
    netAmount: roundMoney(netAmount),
  };
}

export function formatInvoiceMoney(value: number): string {
  return value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
