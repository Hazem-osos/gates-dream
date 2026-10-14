import { rateAnalysisCalculationService } from '../../modules/contracting/technical-office/services/rate-analysis-calculation.service';

describe('rate analysis direct unit cost', () => {
  it('elementCost = consumptionQuota × (1 + waste) × unitCost — 0.15 × 13,500 = 2,025', () => {
    const result = rateAnalysisCalculationService.calculateDirectUnitCost('boq-1', [
      {
        costElementType: 'MATERIAL',
        consumptionQuotaPerUnit: 0.15,
        unitCost: 13_500,
        wasteFactorRate: 0,
      },
    ]);
    expect(result.elements[0].elementCost.toNumber()).toBe(2_025);
    expect(result.totalDirectCost.toNumber()).toBe(2_025);
  });

  it('applies waste on quota before unit cost: 0.15 × 1.10 × 13,500 = 2,227.5', () => {
    const result = rateAnalysisCalculationService.calculateDirectUnitCost('boq-1', [
      {
        costElementType: 'LABOR',
        consumptionQuotaPerUnit: 0.15,
        unitCost: 13_500,
        wasteFactorRate: 0.1,
      },
    ]);
    expect(result.elements[0].elementCost.toNumber()).toBe(2_227.5);
  });

  it('sums material, labor, and subcontractor elements without using parent totals', () => {
    const result = rateAnalysisCalculationService.calculateDirectUnitCost('boq-leaf', [
      {
        costElementType: 'MATERIAL',
        consumptionQuotaPerUnit: 0.15,
        unitCost: 13_500,
        wasteFactorRate: 0,
      },
      {
        costElementType: 'SUBCONTRACTOR',
        consumptionQuotaPerUnit: 1,
        unitCost: 500,
        wasteFactorRate: 0,
      },
    ]);
    expect(result.totalDirectCost.toNumber()).toBe(2_525);
    expect(result.byElementType.MATERIAL.toNumber()).toBe(2_025);
    expect(result.byElementType.SUBCONTRACTOR.toNumber()).toBe(500);
  });

  it('rejects negative quota, cost, or waste above 100%', () => {
    expect(() =>
      rateAnalysisCalculationService.calculateDirectUnitCost('boq-1', [
        {
          costElementType: 'MATERIAL',
          consumptionQuotaPerUnit: -1,
          unitCost: 10,
          wasteFactorRate: 0,
        },
      ])
    ).toThrow(/cannot be negative/);
    expect(() =>
      rateAnalysisCalculationService.calculateDirectUnitCost('boq-1', [
        {
          costElementType: 'MATERIAL',
          consumptionQuotaPerUnit: 1,
          unitCost: 10,
          wasteFactorRate: 1.5,
        },
      ])
    ).toThrow(/between 0 and 1/);
  });

  it('rejects non-finite quota or cost', () => {
    expect(() =>
      rateAnalysisCalculationService.calculateDirectUnitCost('boq-1', [
        {
          costElementType: 'MATERIAL',
          consumptionQuotaPerUnit: Number.POSITIVE_INFINITY,
          unitCost: 10,
          wasteFactorRate: 0,
        },
      ])
    ).toThrow(/finite/);
  });
});
