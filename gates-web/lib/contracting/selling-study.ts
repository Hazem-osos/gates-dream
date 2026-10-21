export type SellingStudyLineInput = {
  supplyQty: number;
  bandFactor: number;
  operationalMarginRate: number;
  administrativeMarginRate: number;
};

export type SellingStudyLineComputed = SellingStudyLineInput & {
  totalMarginRate: number;
  profitValue: number;
  totalProfit: number;
  sellingUnitPrice: number;
};

export function computeSellingStudyLine(input: SellingStudyLineInput): SellingStudyLineComputed {
  const supplyQty = finiteNonNeg(input.supplyQty);
  const bandFactor = finiteNonNeg(input.bandFactor);
  const operationalMarginRate = finiteRate(input.operationalMarginRate);
  const administrativeMarginRate = finiteRate(input.administrativeMarginRate);
  const totalMarginRate = operationalMarginRate + administrativeMarginRate;
  const profitValue = bandFactor * totalMarginRate;
  const totalProfit = profitValue * supplyQty;
  const sellingUnitPrice = bandFactor + profitValue;
  return {
    supplyQty,
    bandFactor,
    operationalMarginRate,
    administrativeMarginRate,
    totalMarginRate,
    profitValue,
    totalProfit,
    sellingUnitPrice,
  };
}

function finiteNonNeg(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function finiteRate(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

/** UI: user types percent (5) → store as 0.05 */
export function percentInputToRate(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n / 100;
}

export function rateToPercentInput(rate: number): string {
  if (!Number.isFinite(rate) || rate === 0) return '';
  const pct = rate * 100;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(4).replace(/\.?0+$/, '');
}
