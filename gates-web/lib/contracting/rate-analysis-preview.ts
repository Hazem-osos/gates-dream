/**
 * Mirrors backend RateAnalysisCalculationService.elementCost:
 * consumptionQuota × (1 + wasteFactorRate) × unitCost
 * Display only — saved totalCostPerUnit from the API is authoritative.
 */
export function previewRateAnalysisLineTotal(input: {
  consumptionQuotaPerUnit: number;
  wasteFactorRate: number;
  unitCost: number;
}): number {
  const quota = Number.isFinite(input.consumptionQuotaPerUnit) ? Math.max(0, input.consumptionQuotaPerUnit) : 0;
  const waste = Number.isFinite(input.wasteFactorRate) ? Math.max(0, input.wasteFactorRate) : 0;
  const unitCost = Number.isFinite(input.unitCost) ? Math.max(0, input.unitCost) : 0;
  return quota * (1 + waste) * unitCost;
}
