import { describe, expect, it } from 'vitest';
import { previewRateAnalysisLineTotal } from './rate-analysis-preview';

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
