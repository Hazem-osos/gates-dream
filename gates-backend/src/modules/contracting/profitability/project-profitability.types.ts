export type ProjectBudgetStatus = 'RATE_ANALYSIS' | 'ESTIMATED_DIRECT' | 'MISSING_BUDGET';

export type ProjectForecastMethodCode = 'PLANNED_REMAINING' | 'MANUAL_FORECAST' | 'PERFORMANCE_TREND';

export type ProjectProfitabilitySignalCode =
  | 'COST_OVERRUN'
  | 'NEGATIVE_MARGIN'
  | 'MARGIN_EROSION'
  | 'BOQ_OVER_BUDGET'
  | 'MISSING_BUDGET'
  | 'HIGH_UNALLOCATED_COST';

export type ProjectRevenueMetrics = {
  originalContractValue: number;
  approvedVariationImpact: number;
  approvedVariationIncrease: number;
  approvedVariationDecrease: number;
  revisedContractValue: number;
  operationalCertifiedValue: number;
  financiallyCertifiedRevenue: number;
  collectedRevenue: number;
  outstandingCertifiedReceivable: number;
};

export type ProjectCostMetrics = {
  plannedCost: number;
  actualCost: number;
  allocatedActualCost: number;
  unallocatedActualCost: number;
  grossCommitment: number;
  remainingCommitment: number;
  uncommittedCostToComplete: number;
  estimateAtCompletion: number;
  forecastProfit: number;
  forecastMarginPercent: number | null;
  currentCertifiedGrossMargin: number;
};

export type ProjectProgressMetrics = {
  progressPercent: number;
  weightingMethod: 'BOQ_SELLING_VALUE';
};

export type PurchaseCommitmentCapability = {
  supported: boolean;
  projectLevelGrossCommitment: number;
  note: string;
};

export type ProjectProfitabilitySummary = {
  companyId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  revenue: ProjectRevenueMetrics;
  cost: ProjectCostMetrics;
  progress: ProjectProgressMetrics;
  purchaseCommitment: PurchaseCommitmentCapability;
  signals: Array<{ code: ProjectProfitabilitySignalCode; message: string; severity: 'warning' | 'critical' }>;
  sources: Record<string, string>;
};

export type BoqProfitabilityRow = {
  projectBOQItemId: string;
  itemCode: string;
  descriptionAr: string;
  originalContractQuantity: number;
  effectiveContractQuantity: number;
  originalUnitSellingPrice: number;
  effectiveUnitSellingPrice: number;
  originalSellingValue: number;
  variationSellingImpact: number;
  effectiveSellingValue: number;
  plannedUnitCost: number | null;
  plannedTotalCost: number | null;
  budgetStatus: ProjectBudgetStatus;
  actualCost: number;
  grossSubcontractCommitment: number;
  remainingCommitment: number;
  certifiedQuantity: number;
  remainingQuantity: number;
  progressPercent: number | null;
  forecastRemainingCost: number;
  forecastMethod: ProjectForecastMethodCode;
  estimateAtCompletion: number;
  forecastProfit: number | null;
  forecastMarginPercent: number | null;
  signals: ProjectProfitabilitySignalCode[];
};

export type SubcontractCommitmentRow = {
  subcontractId: string;
  subcontractNumber: string;
  originalCommitment: number;
  approvedVariationImpact: number;
  revisedCommitment: number;
  actualRecognizedWork: number;
  remainingCommitment: number;
};

export type ProjectCommitmentBreakdown = {
  subcontracts: SubcontractCommitmentRow[];
  purchaseOrders: PurchaseCommitmentCapability;
  totals: {
    grossSubcontractCommitment: number;
    actualSubcontractWork: number;
    remainingSubcontractCommitment: number;
    purchaseGrossCommitment: number;
    totalRemainingCommitment: number;
  };
};

export type ProjectForecastDetail = {
  projectId: string;
  formula: string;
  estimateAtCompletion: number;
  components: {
    actualCost: number;
    remainingCommitment: number;
    uncommittedCostToComplete: number;
  };
  boq: Array<{
    projectBOQItemId: string;
    itemCode: string;
    forecastRemainingCost: number;
    forecastMethod: ProjectForecastMethodCode;
  }>;
  unallocatedActualCost: number;
};
