import type { BOQCostElementType, ProjectBOQItemStatus } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

export interface EvmAsOfOptions {
  asOfDate?: Date;
}

export interface EvmActualCostBreakdown {
  subcontractorCosts: Decimal;
  materialCosts: Decimal;
  warehouseIssueCosts: Decimal;
  installedSiteStockCosts: Decimal;
  directSiteExpenses: Decimal;
  actualCost: Decimal;
}

export interface EvmKpiFlags {
  underBudget: boolean;
  aheadOfSchedule: boolean;
  cpiHealthy: boolean;
  spiOnTrack: boolean;
}

export interface ProjectEvmDashboard {
  companyId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  asOfDate: Date;
  schedule: {
    startDate: Date | null;
    endDate: Date | null;
    elapsedFraction: Decimal;
  };
  plannedValue: Decimal;
  earnedValue: Decimal;
  actualCost: Decimal;
  costVariance: Decimal;
  scheduleVariance: Decimal;
  cpi: Decimal | null;
  spi: Decimal | null;
  budgetAtCompletion: Decimal;
  estimateAtCompletion: Decimal | null;
  varianceAtCompletion: Decimal | null;
  estimateToComplete: Decimal | null;
  actuals: EvmActualCostBreakdown;
  flags: EvmKpiFlags;
}

export interface BoqBudgetVsActualRow {
  projectBOQItemId: string;
  itemCode: string;
  descriptionAr: string;
  unit: string;
  status: ProjectBOQItemStatus;
  plannedQuantity: Decimal;
  plannedQtyToDate: Decimal;
  executedQuantity: Decimal;
  quantityVariance: Decimal;
  plannedUnitRate: Decimal;
  actualUnitCost: Decimal | null;
  unitRateVariance: Decimal | null;
  plannedBudgetCost: Decimal;
  earnedBudgetCost: Decimal;
  allocatedActualCost: Decimal;
  costVariance: Decimal;
  materials: {
    plannedUnitCost: Decimal;
    plannedConsumed: Decimal;
    actualConsumed: Decimal;
    variance: Decimal;
  };
  elements: Record<BOQCostElementType, Decimal>;
}

export interface ProjectBudgetVsActual {
  companyId: string;
  projectId: string;
  asOfDate: Date;
  totals: {
    plannedQuantity: Decimal;
    executedQuantity: Decimal;
    plannedBudgetCost: Decimal;
    earnedBudgetCost: Decimal;
    allocatedActualCost: Decimal;
    costVariance: Decimal;
    plannedMaterials: Decimal;
    actualMaterials: Decimal;
    materialVariance: Decimal;
  };
  items: BoqBudgetVsActualRow[];
}
