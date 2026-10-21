import { ELEMENT_TYPES } from './labels';
import type { BOQCostElementType } from './types';

export type RateAnalysisSummaryInput = {
  costElementType: BOQCostElementType;
  totalCostPerUnit: number;
};

/** Groups saved line totals by cost element. Does not recompute the server total. */
export function summarizeRateAnalysis(items: RateAnalysisSummaryInput[]): {
  byType: Array<{ costElementType: BOQCostElementType; total: number }>;
  directUnitCost: number;
} {
  const byType = ELEMENT_TYPES.map((costElementType) => ({
    costElementType,
    total: items
      .filter((row) => row.costElementType === costElementType)
      .reduce((sum, row) => sum + (Number.isFinite(row.totalCostPerUnit) ? row.totalCostPerUnit : 0), 0),
  }));
  return {
    byType,
    directUnitCost: byType.reduce((sum, row) => sum + row.total, 0),
  };
}

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

export type BoqMarkupRates = {
  generalOverheadRate: number;
  siteOverheadRate: number;
  contingencyRiskRate: number;
  profitMarginRate: number;
  contractTaxesRate: number;
};

export type BoqSellingLadder = {
  directUnitCost: number;
  siteOverheadRate: number;
  siteOverheadValue: number;
  generalOverheadRate: number;
  generalOverheadValue: number;
  contingencyRiskRate: number;
  contingencyRiskValue: number;
  costWithOverhead: number;
  profitMarginRate: number;
  profitValue: number;
  priceAfterProfit: number;
  contractTaxesRate: number;
  taxValue: number;
  unitSellingPrice: number;
};

function finiteAmount(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function finiteRate(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

/**
 * Mirrors RateAnalysisCalculationService.computeBoqItemSellingPriceInTx:
 * direct × (1 + site + general + contingency) × (1 + profit) × (1 + tax).
 * Display only — saved unitSellingPrice stays authoritative.
 */
export function previewBoqSellingLadder(directUnitCost: number, rates: BoqMarkupRates): BoqSellingLadder {
  const direct = finiteAmount(directUnitCost);
  const siteOverheadRate = finiteRate(rates.siteOverheadRate);
  const generalOverheadRate = finiteRate(rates.generalOverheadRate);
  const contingencyRiskRate = finiteRate(rates.contingencyRiskRate);
  const profitMarginRate = finiteRate(rates.profitMarginRate);
  const contractTaxesRate = finiteRate(rates.contractTaxesRate);
  const siteOverheadValue = direct * siteOverheadRate;
  const generalOverheadValue = direct * generalOverheadRate;
  const contingencyRiskValue = direct * contingencyRiskRate;
  const costWithOverhead = direct * (1 + siteOverheadRate + generalOverheadRate + contingencyRiskRate);
  const profitValue = costWithOverhead * profitMarginRate;
  const priceAfterProfit = costWithOverhead + profitValue;
  const taxValue = priceAfterProfit * contractTaxesRate;
  return {
    directUnitCost: direct,
    siteOverheadRate,
    siteOverheadValue,
    generalOverheadRate,
    generalOverheadValue,
    contingencyRiskRate,
    contingencyRiskValue,
    costWithOverhead,
    profitMarginRate,
    profitValue,
    priceAfterProfit,
    contractTaxesRate,
    taxValue,
    unitSellingPrice: priceAfterProfit + taxValue,
  };
}
