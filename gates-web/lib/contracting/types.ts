export type Moneyish = string | number | null | undefined;

export type BoqItemUnit = 'M2' | 'M3' | 'TON' | 'ITEM' | 'LM' | 'LS';
export type ProjectBOQItemStatus = 'PENDING_PRICING' | 'PRICED' | 'APPROVED_IN_CONTRACT';
export type BOQCostElementType = 'MATERIAL' | 'LABOR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'SITE_EXPENSE';
export type MeasurementSheetStatus =
  | 'DRAFT'
  | 'SITE_ENGINEER_VERIFIED'
  | 'CONSULTANT_APPROVED'
  | 'INVOICED_IN_EXTRACT';

export type ClientContractStatus = 'ACTIVE' | 'SUSPENDED' | 'COMPLETED';
export type ClientInvoiceType = 'INTERIM' | 'FINAL_SETTLEMENT';
export type ClientInvoiceStatus =
  | 'DRAFT'
  | 'SUBMITTED_TO_CLIENT'
  | 'CLIENT_APPROVED'
  | 'FINANCE_POSTED'
  | 'REJECTED'
  | 'PAID';
export type SiteStockMaterialStatus = 'STORED_ON_SITE' | 'INSTALLED_AND_DEDUCTED' | 'REJECTED';

export type ProjectLgType =
  | 'BID_BOND_INITIAL'
  | 'ADVANCE_PAYMENT_BOND'
  | 'PERFORMANCE_BOND_FINAL'
  | 'RETENTION_RELEASE_BOND';
export type ProjectLgStatus =
  | 'ACTIVE_ISSUED'
  | 'EXTENDED'
  | 'AMENDED_VALUE'
  | 'RELEASED_RETURNED'
  | 'LIQUIDATED_CONFISCATED';

export type ContractingProject = {
  id: string;
  projectCode: string;
  projectName: string;
  status?: string;
  contractValue?: Moneyish;
  startDate?: string | null;
  endDate?: string | null;
  customerId?: string | null;
  customer?: { id: string; arabicName: string; code?: string | null } | null;
};

export type RateAnalysisItem = {
  id: string;
  costElementType: BOQCostElementType;
  resourceCode?: string | null;
  descriptionAr: string;
  descriptionEn?: string | null;
  unit: string;
  consumptionQuotaPerUnit: Moneyish;
  unitCost: Moneyish;
  wasteFactorRate: Moneyish;
  totalCostPerUnit: Moneyish;
  notes?: string | null;
};

export type BoqMarkupStructure = {
  id?: string;
  generalOverheadRate: Moneyish;
  siteOverheadRate: Moneyish;
  contingencyRiskRate: Moneyish;
  profitMarginRate: Moneyish;
  contractTaxesRate: Moneyish;
};

export type OwnerBoqItem = {
  id: string;
  projectId: string;
  itemCode: string;
  descriptionAr: string;
  descriptionEn?: string | null;
  unit: BoqItemUnit;
  contractQuantity: Moneyish;
  directCostEstimated: Moneyish;
  indirectMarkupRate: Moneyish;
  unitSellingPrice: Moneyish;
  totalSellingPrice: Moneyish;
  cumulativeExecutedQty: Moneyish;
  status: ProjectBOQItemStatus;
  rateAnalysisItems?: RateAnalysisItem[];
  markupStructures?: BoqMarkupStructure[];
  costStatus?: {
    pricingStatus: ProjectBOQItemStatus;
    hasRateAnalysis: boolean;
    elementCount: number;
    plannedBudgetCost: Moneyish;
    earnedBudgetCost: Moneyish;
    quantityVariance: Moneyish;
    completionRate: Moneyish;
  };
};

export type MeasurementSheet = {
  id: string;
  projectId: string;
  projectBOQItemId: string;
  sheetNumber: string;
  measurementDate: string;
  locationZone?: string | null;
  axisGridRef?: string | null;
  statement?: string | null;
  multiplierCount: Moneyish;
  dimensionLength?: Moneyish | null;
  dimensionWidth?: Moneyish | null;
  dimensionHeight?: Moneyish | null;
  calculatedGrossQty: Moneyish;
  deductionQty: Moneyish;
  netExecutedQty: Moneyish;
  attachments?: unknown;
  status: MeasurementSheetStatus;
};

export type ClientInvoiceItem = {
  id: string;
  projectBOQItemId: string;
  previousQuantity: Moneyish;
  currentQuantity: Moneyish;
  cumulativeQuantity: Moneyish;
  unitSellingPrice: Moneyish;
  currentAmount: Moneyish;
};

export type ClientInvoice = {
  id: string;
  invoiceNumber: string;
  sequenceNumber: number;
  periodStartDate: string;
  periodEndDate: string;
  type: ClientInvoiceType;
  status: ClientInvoiceStatus;
  grossCurrentWorks: Moneyish;
  previousGrossWorks: Moneyish;
  cumulativeGrossWorks: Moneyish;
  materialsOnSiteCurrent: Moneyish;
  materialsOnSiteDeduction: Moneyish;
  advancePaymentRecovery: Moneyish;
  retentionDeduction: Moneyish;
  engineeringStampsDeduction: Moneyish;
  otherClientPenalties: Moneyish;
  netPayableByClient: Moneyish;
  journalEntryId?: string | null;
  items?: ClientInvoiceItem[];
};

export type ClientContractDetail = {
  id: string;
  projectId: string;
  contractNumber: string;
  clientCustomerId: string;
  contractDate: string;
  totalContractValue: Moneyish;
  advancePaymentAmount: Moneyish;
  advanceRecoveryRate: Moneyish;
  retentionRate: Moneyish;
  engineeringStampsRate: Moneyish;
  status: ClientContractStatus;
  client?: { id: string; arabicName: string } | null;
  project?: ContractingProject | null;
  invoices: ClientInvoice[];
  billingProgress?: {
    invoiceCount: number;
    certifiedInvoiceCount: number;
    cumulativeGrossWorks: Moneyish;
    cumulativeNetPayable: Moneyish;
    recoveredAdvance: Moneyish;
    remainingAdvance: Moneyish;
    retained: Moneyish;
    billingProgressRate: Moneyish;
  };
};

export type SiteStockMaterial = {
  id: string;
  projectId: string;
  clientInvoiceId?: string | null;
  materialDescription: string;
  deliveryDate: string;
  warehouseReceiptRef?: string | null;
  deliveredQuantity: Moneyish;
  unitPrice: Moneyish;
  approvedPercentage: Moneyish;
  netClaimedAmount: Moneyish;
  status: SiteStockMaterialStatus;
};

export type ProjectLetterOfGuarantee = {
  id: string;
  lgNumber: string;
  bankAccountId: string;
  bankName: string;
  beneficiaryName: string;
  type: ProjectLgType;
  issuanceDate: string;
  expiryDate: string;
  originalAmount: Moneyish;
  currentAmount: Moneyish;
  cashMarginRate: Moneyish;
  cashMarginAmount: Moneyish;
  issuanceCommissionAmount: Moneyish;
  status: ProjectLgStatus;
  renewalCount?: number;
  journalEntryId?: string | null;
};

export type ProjectLgList = {
  projectId: string;
  counts: Partial<Record<ProjectLgStatus, number>>;
  tabs: {
    ALL: ProjectLetterOfGuarantee[];
    ACTIVE: ProjectLetterOfGuarantee[];
    CLOSED: ProjectLetterOfGuarantee[];
    ACTIVE_ISSUED: ProjectLetterOfGuarantee[];
    EXTENDED: ProjectLetterOfGuarantee[];
    AMENDED_VALUE: ProjectLetterOfGuarantee[];
    RELEASED_RETURNED: ProjectLetterOfGuarantee[];
    LIQUIDATED_CONFISCATED: ProjectLetterOfGuarantee[];
  };
};

export type ProjectEvmDashboard = {
  companyId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  asOfDate: string;
  schedule: { startDate: string | null; endDate: string | null; elapsedFraction: Moneyish };
  plannedValue: Moneyish;
  earnedValue: Moneyish;
  actualCost: Moneyish;
  costVariance: Moneyish;
  scheduleVariance: Moneyish;
  cpi: Moneyish | null;
  spi: Moneyish | null;
  budgetAtCompletion: Moneyish;
  estimateAtCompletion: Moneyish | null;
  varianceAtCompletion: Moneyish | null;
  estimateToComplete: Moneyish | null;
  actuals: {
    subcontractorCosts: Moneyish;
    materialCosts: Moneyish;
    warehouseIssueCosts: Moneyish;
    installedSiteStockCosts: Moneyish;
    directSiteExpenses: Moneyish;
    actualCost: Moneyish;
  };
  flags: {
    underBudget: boolean;
    aheadOfSchedule: boolean;
    cpiHealthy: boolean;
    spiOnTrack: boolean;
  };
};

export type BudgetVsActualRow = {
  projectBOQItemId: string;
  itemCode: string;
  descriptionAr: string;
  unit: string;
  status: ProjectBOQItemStatus;
  plannedQuantity: Moneyish;
  plannedQtyToDate: Moneyish;
  executedQuantity: Moneyish;
  quantityVariance: Moneyish;
  plannedUnitRate: Moneyish;
  actualUnitCost: Moneyish | null;
  unitRateVariance: Moneyish | null;
  plannedBudgetCost: Moneyish;
  earnedBudgetCost: Moneyish;
  allocatedActualCost: Moneyish;
  costVariance: Moneyish;
  materials: {
    plannedUnitCost: Moneyish;
    plannedConsumed: Moneyish;
    actualConsumed: Moneyish;
    variance: Moneyish;
  };
};

export type ProjectBudgetVsActual = {
  companyId: string;
  projectId: string;
  asOfDate: string;
  totals: {
    plannedQuantity: Moneyish;
    executedQuantity: Moneyish;
    plannedBudgetCost: Moneyish;
    earnedBudgetCost: Moneyish;
    allocatedActualCost: Moneyish;
    costVariance: Moneyish;
    plannedMaterials: Moneyish;
    actualMaterials: Moneyish;
    materialVariance: Moneyish;
  };
  items: BudgetVsActualRow[];
};

export type LiveClientBreakdown = {
  grossCurrentWorks: number;
  materialsOnSiteCurrent: number;
  materialsOnSiteDeduction: number;
  netMaterialsOnSite: number;
  advancePaymentRecovery: number;
  remainingAdvanceAfter: number;
  retentionDeduction: number;
  engineeringStampsDeduction: number;
  otherClientPenalties: number;
  netPayableByClient: number;
};

export const CLIENT_INVOICE_STEPS = [
  'DRAFT',
  'SUBMITTED_TO_CLIENT',
  'CLIENT_APPROVED',
  'FINANCE_POSTED',
] as const satisfies readonly ClientInvoiceStatus[];

export const HISTORICAL_CLIENT_INVOICE_STATUSES: readonly ClientInvoiceStatus[] = [
  'CLIENT_APPROVED',
  'FINANCE_POSTED',
  'PAID',
];
