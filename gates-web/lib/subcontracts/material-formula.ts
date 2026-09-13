import { toMoney } from './money';

export function previewMaterialOveruse(input: {
  standardEngineeredQty: number;
  actualIssuedQty: number;
  marketPricePerUnit: number;
  scrapToleranceRate: number;
  adminOverheadRate: number;
}) {
  const allowed = input.standardEngineeredQty * (1 + input.scrapToleranceRate);
  const excessQty = Math.max(0, input.actualIssuedQty - allowed);
  const rawPenalty = excessQty * input.marketPricePerUnit;
  const overheadAmount = rawPenalty * input.adminOverheadRate;
  return {
    allowedThreshold: allowed,
    excessQty,
    rawPenalty,
    overheadAmount,
    totalDeduction: rawPenalty + overheadAmount,
  };
}

export function defaultOverheadRate(contractRate: string | number | null | undefined): number {
  const rate = toMoney(contractRate);
  return rate > 0 ? rate : 0.15;
}
