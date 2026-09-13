import { projectScenario } from '../../modules/ai/tools/simulator/cfo-simulator.math';
import { CfoSimulatorService } from '../../modules/ai/tools/simulator/cfo-simulator.service';
import type { CfoSimulatorPorts } from '../../modules/ai/tools/simulator/cfo-simulator.types';

describe('CFO what-if simulator', () => {
  it('projects a 3% cash discount against margin and DSO acceleration', () => {
    const result = projectScenario({
      scenarioType: 'CASH_DISCOUNT_OFFER',
      percentageDelta: -3,
      volumeDelta: 0,
      monthlyRevenue: 1_000_000,
      monthlyCogs: 700_000,
      monthlyExpenses: 80_000,
      cashRatio: 0.4,
      dsoDays: 45,
    });

    expect(result.projectedMonthlyRevenue).toBeLessThan(1_000_000);
    expect(result.marginImpactEgp).toBeLessThan(0);
    expect(result.cashAccelerationDays).toBeGreaterThan(0);
    expect(result.cashFreedEgp).toBeGreaterThan(0);
  });

  it('projects a price hike as higher revenue and margin when volume holds', () => {
    const result = projectScenario({
      scenarioType: 'PRICE_ADJUSTMENT',
      percentageDelta: 5,
      volumeDelta: 0,
      monthlyRevenue: 1_000_000,
      monthlyCogs: 700_000,
      monthlyExpenses: 80_000,
      cashRatio: 0.3,
      dsoDays: 40,
    });

    expect(result.projectedMonthlyRevenue).toBe(1_050_000);
    expect(result.marginImpactEgp).toBe(50_000);
    expect(result.cashAccelerationDays).toBe(0);
  });

  it('loads posted GL baselines then returns the executive payload', async () => {
    const ports: CfoSimulatorPorts = {
      getIncomeStatement: async () => ({
        revenues: 3_000_000,
        costOfGoodsSold: 2_100_000,
        grossProfit: 900_000,
        operatingExpenses: 240_000,
        summary: {
          totalRevenue: 3_000_000,
          costOfGoodsSold: 2_100_000,
          grossProfit: 900_000,
          totalExpenses: 240_000,
        },
      }),
      salesMix: async () => ({ cash: 1_200_000, credit: 1_800_000 }),
      receivablesOutstanding: async () => 1_350_000,
    };
    const service = new CfoSimulatorService(ports);
    const result = await service.simulate('company-1', {
      scenarioType: 'CASH_DISCOUNT_OFFER',
      percentageDelta: -3,
      lookbackPeriodMonths: 3,
    });

    expect(result.currentMonthlyRevenue).toBe(1_000_000);
    expect(result.baseline.grossMarginPercent).toBe(30);
    expect(result.baseline.cashSalesRatio).toBe(40);
    expect(result.projectedMonthlyRevenue).toBeLessThan(result.currentMonthlyRevenue);
    expect(result.marginImpactEgp).toBeLessThan(0);
    expect(result.cashAccelerationDays).toBeGreaterThan(0);
    expect(result.executiveRecommendation.length).toBeGreaterThan(10);
    expect(['APPLY', 'DO_NOT_APPLY', 'APPLY_WITH_CONDITIONS']).toContain(result.verdict);
  });
});
