import { describe, expect, it } from 'vitest';
import {
  executionPlanAnalysisLine,
  executionPlanDistribution,
  executionPlanTenderTotals,
} from './execution-plan-view';

describe('executionPlanTenderTotals', () => {
  it('multiplies tender quantity by the tender unit rate', () => {
    const row = executionPlanTenderTotals({
      contractQuantity: 204_581.054,
      unitSellingPrice: 9.53,
    });
    expect(row.tenderTotal).toBeCloseTo(204_581.054 * 9.53);
  });
});

describe('executionPlanDistribution', () => {
  it('costs the allocated quantity at the planned unit cost', () => {
    const row = executionPlanDistribution({
      allocatedQuantity: 122_748.6324,
      plannedUnitCost: 4_500,
      contractQuantity: 204_581.054,
    });
    expect(row.distributionCost).toBeCloseTo(552_368_845.8, 0);
    expect(row.overrunPercent).toBe(0);
  });

  it('reports overrun only when allocated quantity exceeds the tender quantity', () => {
    const row = executionPlanDistribution({
      allocatedQuantity: 120,
      plannedUnitCost: 10,
      contractQuantity: 100,
    });
    expect(row.overrunPercent).toBeCloseTo(20);
  });
});

describe('executionPlanAnalysisLine', () => {
  it('scales quota and unit cost across tender and allocated quantities', () => {
    const row = executionPlanAnalysisLine({
      consumptionQuotaPerUnit: 10,
      unitCost: 450,
      totalCostPerUnit: 4_500,
      contractQuantity: 204_581.054,
      allocatedQuantity: 122_748.6324,
    });
    expect(row.analysisTotalQuantity).toBeCloseTo(2_045_810.54, 2);
    expect(row.analysisTotalCost).toBeCloseTo(920_614_743, 0);
    expect(row.distributionQuantity).toBeCloseTo(1_227_486.324, 3);
    expect(row.distributionCost).toBeCloseTo(552_368_845.8, 0);
    expect(row.overrunPercent).toBe(0);
  });
});
