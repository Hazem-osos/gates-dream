export type ExecutionHealthCode =
  | 'ON_TRACK'
  | 'SCHEDULE_DELAY'
  | 'COST_OVERRUN'
  | 'NEGATIVE_MARGIN'
  | 'LOW_CPI'
  | 'LOW_SPI'
  | 'UNPLANNED_SCOPE'
  | 'MISSING_BASELINE'
  | 'MISSING_BUDGET';

export type ProjectExecutionPerformanceSummary = {
  asOfDate: string;
  progress: {
    plannedPercent: number;
    actualPercent: number;
    scheduleVariancePoints: number;
    weightingMethod: string;
    actualProgressSource: string;
  };
  evm: {
    pv: number;
    ev: number;
    ac: number;
    bac: number;
    cpi: number | null;
    spi: number | null;
    cv: number;
    sv: number;
    definitions: Record<string, string>;
  };
  schedule: {
    originalBaselineFinish: string | null;
    currentPlannedFinish: string | null;
    forecastFinish: string | null;
    forecastFinishMethod: string;
  };
  financial: {
    certifiedRevenue: number;
    collectedCash: number;
    actualCost: number;
    eac: number;
    forecastProfit: number;
    forecastMarginPercent: number | null;
    source: string;
  };
  health: Array<{ code: ExecutionHealthCode; message: string; severity: 'info' | 'warning' | 'critical' }>;
};

export type ExecutionActivityPerformanceRow = {
  activityId: string;
  code: string;
  nameAr: string;
  plannedStart: string;
  plannedFinish: string;
  weight: number;
  plannedPercent: number;
  actualPercent: number;
  pv: number;
  ev: number;
  acShare: number;
  cpi: number | null;
  spi: number | null;
  status: string;
};

export type UnplannedScopeRow = {
  projectBOQItemId: string;
  itemCode: string;
  effectiveQuantity: number;
  plannedQuantity: number;
  unplannedQuantity: number;
  variationOrderNumber?: string;
};
