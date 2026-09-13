export type SubcontractStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'COMPLETED' | 'TERMINATED';

export type SubcontractInvoiceStatus =
  | 'DRAFT'
  | 'SITE_SUBMITTED'
  | 'CONSULTANT_APPROVED'
  | 'TECH_OFFICE_APPROVED'
  | 'FINANCE_POSTED'
  | 'REJECTED'
  | 'PAID';

export type SubcontractInvoiceType = 'INTERIM_RUNNING' | 'FINAL_SETTLEMENT';

export type SitePenaltyType =
  | 'DELAY_PENALTY'
  | 'NCR_QUALITY_DEFECT'
  | 'HSE_SAFETY_VIOLATION'
  | 'MANPOWER_SHORTAGE'
  | 'EQUIPMENT_DEMURRAGE';

export type SitePenaltyStatus = 'PENDING' | 'DISPUTED' | 'APPROVED_FOR_DEDUCTION' | 'APPLIED_TO_INVOICE';

export type MaterialLogStatus = 'PENDING_DEDUCTION' | 'DEDUCTED' | 'WAIVED';

export type DirectChargeStatus = 'PENDING' | 'APPLIED';

export const HISTORICAL_INVOICE_STATUSES: readonly SubcontractInvoiceStatus[] = [
  'CONSULTANT_APPROVED',
  'TECH_OFFICE_APPROVED',
  'FINANCE_POSTED',
  'PAID',
];

export const APPROVAL_STEPS = [
  'DRAFT',
  'SITE_SUBMITTED',
  'CONSULTANT_APPROVED',
  'TECH_OFFICE_APPROVED',
  'FINANCE_POSTED',
] as const satisfies readonly SubcontractInvoiceStatus[];

export type Subcontractor = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  taxRegistrationNumber?: string | null;
  commercialRegister?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: string;
};

export type ContractingProjectOption = {
  id: string;
  projectCode: string;
  projectName: string;
  status?: string;
};

export type SubcontractBoqItem = {
  id: string;
  itemCode: string;
  descriptionAr: string;
  descriptionEn?: string | null;
  unit: string;
  contractQuantity: string | number;
  unitPrice: string | number;
  totalPrice: string | number;
  maxAllowedQuantity: string | number;
  cumulativeExecutedQty: string | number;
  completionPercentage?: string | number;
};

export type SubcontractInvoiceItem = {
  id?: string;
  subcontractBOQItemId: string;
  previousQuantity: string | number;
  currentQuantity: string | number;
  totalCumulativeQuantity: string | number;
  completionPercentage: string | number;
  unitPrice: string | number;
  totalCurrentAmount: string | number;
};

export type SubcontractInvoice = {
  id: string;
  invoiceNumber: string;
  sequenceNumber: number;
  periodStartDate: string;
  periodEndDate: string;
  type: SubcontractInvoiceType;
  status: SubcontractInvoiceStatus;
  grossCurrentAmount: string | number;
  grossCumulativeAmount: string | number;
  previousGrossAmount: string | number;
  advancePaymentDeduction: string | number;
  retentionDeduction: string | number;
  taxWithholdingDeduction: string | number;
  socialInsuranceDeduction: string | number;
  materialOveruseDeduction: string | number;
  sitePenaltiesDeduction: string | number;
  directExecutionDeduction: string | number;
  earlyPaymentDiscountDeduction: string | number;
  netPayableAmount: string | number;
  journalEntryId?: string | null;
  notes?: string | null;
  items?: SubcontractInvoiceItem[];
};

export type SitePenalty = {
  id: string;
  subcontractId: string;
  subcontractInvoiceId?: string | null;
  penaltyType: SitePenaltyType;
  amount: string | number;
  incidentDate: string;
  description: string;
  consultantReportRef?: string | null;
  status: SitePenaltyStatus;
};

export type MaterialReconciliation = {
  id: string;
  subcontractId: string;
  subcontractInvoiceId?: string | null;
  itemId: string;
  warehouseIssueSlipNumber?: string | null;
  standardEngineeredQty: string | number;
  actualIssuedQty: string | number;
  scrapExcessQty: string | number;
  marketPricePerUnit: string | number;
  adminOverheadPercentage: string | number;
  totalPenaltyAmount: string | number;
  status: MaterialLogStatus;
};

export type DirectExecutionCharge = {
  id: string;
  subcontractId: string;
  subcontractInvoiceId?: string | null;
  reason: string;
  thirdPartyVendorName?: string | null;
  directCostIncurred: string | number;
  totalDeduction: string | number;
  status: DirectChargeStatus;
};

export type SubcontractDetail = {
  id: string;
  subcontractNumber: string;
  contractDate: string;
  totalContractValue: string | number;
  status: SubcontractStatus;
  advancePaymentTotal: string | number;
  advancePaymentRecoveryRate: string | number;
  retentionRate: string | number;
  taxWithholdingRate: string | number;
  socialInsuranceRate: string | number;
  maxAllowedVariationOrderRate: string | number;
  standardScrapToleranceRate: string | number;
  contractAdminOverheadRate: string | number;
  earlyPaymentDiscountRate: string | number;
  subcontractor: Subcontractor;
  project: ContractingProjectOption;
  boqItems: SubcontractBoqItem[];
  invoices: SubcontractInvoice[];
  sitePenalties?: SitePenalty[];
  materialReconciliations?: MaterialReconciliation[];
  directExecutionCharges?: DirectExecutionCharge[];
};

export type SubcontractListItem = {
  id: string;
  subcontractNumber: string;
  contractDate: string;
  totalContractValue: string | number;
  status: SubcontractStatus;
  subcontractor: Subcontractor;
  project: ContractingProjectOption;
  invoices: Array<{
    id: string;
    status: SubcontractInvoiceStatus;
    netPayableAmount: string | number;
    grossCurrentAmount: string | number;
  }>;
};

export type Form41PreviewRow = {
  taxId: string;
  commercialRegister: string;
  name: string;
  address: string;
  taxOffice: string;
  dealNature: string;
  gross: string;
  net: string;
  ratePercent: string;
  withheld: string;
  invoiceRef: string;
};

export type Form41Preview = {
  start: string;
  end: string;
  rows: Form41PreviewRow[];
};

export type LiveInvoiceLine = {
  subcontractBOQItemId: string;
  itemCode: string;
  descriptionAr: string;
  descriptionEn?: string | null;
  unit: string;
  contractQuantity: number;
  maxAllowedQuantity: number;
  unitPrice: number;
  previousQuantity: number;
  currentQuantity: number;
  totalCumulativeQuantity: number;
  completionPercentage: number;
  totalCurrentAmount: number;
  exceedsMax: boolean;
  approachingMax: boolean;
};

export type LiveInvoiceBreakdown = {
  grossCurrentAmount: number;
  advancePaymentDeduction: number;
  retentionDeduction: number;
  taxWithholdingDeduction: number;
  socialInsuranceDeduction: number;
  materialOveruseDeduction: number;
  sitePenaltiesDeduction: number;
  directExecutionDeduction: number;
  earlyPaymentDiscountDeduction: number;
  netPayableAmount: number;
  remainingAdvanceAfter: number;
  lines: LiveInvoiceLine[];
};

export type GlPreviewLine = {
  side: 'debit' | 'credit';
  label: string;
  amount: number;
};
