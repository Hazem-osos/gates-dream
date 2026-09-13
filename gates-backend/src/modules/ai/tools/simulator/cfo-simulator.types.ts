export const CFO_SCENARIO_TYPES = ['CASH_DISCOUNT_OFFER', 'PRICE_ADJUSTMENT', 'OVERHEAD_INCREASE'] as const;

export type CfoScenarioType = (typeof CFO_SCENARIO_TYPES)[number];

export type CfoSimulatorVerdict = 'APPLY' | 'DO_NOT_APPLY' | 'APPLY_WITH_CONDITIONS';

export type CfoSimulatorInput = {
  scenarioType: CfoScenarioType;
  percentageDelta: number;
  expectedVolumeDeltaPercent?: number;
  lookbackPeriodMonths?: number;
};

export type CfoSimulatorBaseline = {
  lookbackFrom: string;
  lookbackTo: string;
  lookbackPeriodMonths: number;
  periodRevenue: number;
  periodCogs: number;
  periodGrossProfit: number;
  periodOperatingExpenses: number;
  currentMonthlyRevenue: number;
  monthlyCogs: number;
  monthlyGrossProfit: number;
  monthlyOperatingExpenses: number;
  grossMarginPercent: number;
  cashSalesRatio: number;
  creditSalesRatio: number;
  dsoDays: number;
  receivablesOutstanding: number;
};

export type CfoSimulatorResult = {
  scenarioType: CfoScenarioType;
  percentageDelta: number;
  expectedVolumeDeltaPercent: number;
  currentMonthlyRevenue: number;
  projectedMonthlyRevenue: number;
  projectedGrossMarginPercent: number;
  marginImpactEgp: number;
  netProfitImpactEgp: number;
  cashAccelerationDays: number;
  cashFreedEgp: number;
  workingCapitalDeltaEgp: number;
  breakEvenVolumeDeltaPercent: number | null;
  verdict: CfoSimulatorVerdict;
  executiveRecommendation: string;
  baseline: CfoSimulatorBaseline;
  assumptions: string[];
};

export type CfoSimulatorPorts = {
  getIncomeStatement: (params: {
    companyId: string;
    branchId?: string;
    fiscalYearId?: string;
    startDate: Date;
    endDate: Date;
  }) => Promise<{
    revenues?: number;
    costOfGoodsSold?: number;
    grossProfit?: number;
    operatingExpenses?: number;
    summary?: Record<string, number>;
  }>;
  salesMix: (input: {
    companyId: string;
    branchId?: string;
    startDate: Date;
    endDate: Date;
  }) => Promise<{ cash: number; credit: number }>;
  receivablesOutstanding: (input: { companyId: string; branchId?: string }) => Promise<number>;
};
