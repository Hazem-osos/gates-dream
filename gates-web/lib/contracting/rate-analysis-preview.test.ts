import { describe, expect, it } from 'vitest';
import {
  previewBoqSellingLadder,
  previewRateAnalysisLineTotal,
  summarizeRateAnalysis,
} from './rate-analysis-preview';

describe('previewRateAnalysisLineTotal', () => {
  it('uses quota × unit cost when waste is zero (0.15 × 13,500 = 2,025)', () => {
    expect(
      previewRateAnalysisLineTotal({
        consumptionQuotaPerUnit: 0.15,
        wasteFactorRate: 0,
        unitCost: 13500,
      })
    ).toBe(2025);
  });

  it('sums saved line totals by cost element without inventing a service type', () => {
    const summary = summarizeRateAnalysis([
      { costElementType: 'MATERIAL', totalCostPerUnit: 2025 },
      { costElementType: 'LABOR', totalCostPerUnit: 500 },
      { costElementType: 'MATERIAL', totalCostPerUnit: 100 },
    ]);
    expect(summary.byType.find((row) => row.costElementType === 'MATERIAL')?.total).toBe(2125);
    expect(summary.byType.find((row) => row.costElementType === 'EQUIPMENT')?.total).toBe(0);
    expect(summary.directUnitCost).toBe(2625);
    expect(summary.byType.map((row) => row.costElementType)).not.toContain('SERVICE');
  });

  it('applies waste factor as a rate, not a percent', () => {
    expect(
      previewRateAnalysisLineTotal({
        consumptionQuotaPerUnit: 1,
        wasteFactorRate: 0.1,
        unitCost: 100,
      })
    ).toBeCloseTo(110);
  });
});

describe('previewBoqSellingLadder', () => {
  it('loads overhead, then profit, then tax the same way the server prices a BOQ line', () => {
    const ladder = previewBoqSellingLadder(100, {
      siteOverheadRate: 0.05,
      generalOverheadRate: 0.08,
      contingencyRiskRate: 0.03,
      profitMarginRate: 0.12,
      contractTaxesRate: 0.14,
    });
    expect(ladder.siteOverheadValue).toBeCloseTo(5);
    expect(ladder.generalOverheadValue).toBeCloseTo(8);
    expect(ladder.contingencyRiskValue).toBeCloseTo(3);
    expect(ladder.costWithOverhead).toBeCloseTo(116);
    expect(ladder.profitValue).toBeCloseTo(13.92);
    expect(ladder.priceAfterProfit).toBeCloseTo(129.92);
    expect(ladder.taxValue).toBeCloseTo(18.1888);
    expect(ladder.unitSellingPrice).toBeCloseTo(148.1088);
  });
});
