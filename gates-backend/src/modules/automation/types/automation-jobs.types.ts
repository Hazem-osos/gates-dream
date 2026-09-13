export type AutomationEventName =
  | 'NOTIFY_CHEQUES_DUE_FOR_DEPOSIT'
  | 'ALERT_BOUNCED_CHEQUE'
  | 'SUBCONTRACT_INVOICE_WORKFLOW'
  | 'UNIT_CANCELLATION_RELEASED'
  | 'DYNAMIC_PRICING_REVALUATION';

export type LateFeeJobKind = 'orchestrator' | 'tenant';
export type PricingJobKind = 'orchestrator' | 'tenant';

export interface DailyLateFeeJobData {
  kind: LateFeeJobKind;
  companyId?: string;
  asOfDate?: string;
}

export interface DailyLateFeeTenantResult {
  companyId: string;
  skipped: boolean;
  processedCount: number;
  totalLateFees: string;
  error?: string;
}

export interface DailyLateFeeOrchestratorResult {
  asOfDate: string;
  tenantsAttempted: number;
  tenantsSucceeded: number;
  tenantsFailed: number;
  tenantsSkipped: number;
  processedInstallments: number;
  totalLateFees: string;
  failures: Array<{ companyId: string; error: string }>;
}

export interface ChequeMaturityJobData {
  asOfDate?: string;
}

export interface ChequeDueForDepositItem {
  chequeId: string;
  chequeNumber: string;
  bankName: string;
  drawerName: string;
  chequeDate: string;
  amount: string;
  unitContractId: string;
  businessDaysUntilDue: number;
}

export interface ChequeBouncedJobData {
  companyId: string;
  chequeId: string;
  unitContractId: string;
  unitInstallmentId: string | null;
  customerId: string | null;
  amount: string;
  bounceReason: string;
  bouncedAt: string;
}

export interface SubcontractInvoiceWorkflowJobData {
  companyId: string;
  invoiceId: string;
  subcontractId: string;
  invoiceNumber: string;
  fromStatus: string | null;
  toStatus: 'SITE_SUBMITTED' | 'CONSULTANT_APPROVED' | 'TECH_OFFICE_APPROVED' | 'FINANCE_POSTED';
  netPayableAmount: string;
  occurredAt: string;
}

export interface UnitCancellationReleasedJobData {
  companyId: string;
  contractId: string;
  settlementId: string;
  propertyUnitId: string | null;
  legacyUnitId: string;
  cancellationDate: string;
}

export interface DynamicPricingJobData {
  kind: PricingJobKind;
  companyId?: string;
  requestedBy?: string;
  asOfDate?: string;
}

export const AUTOMATION_QUEUE_NAMES = {
  schedulers: 'automation-schedulers',
  cheques: 'real-estate-cheques',
  subcontractWorkflows: 'subcontract-workflows',
  cancellations: 'real-estate-cancellations',
} as const;

export const AUTOMATION_JOB_NAMES = {
  dailyLateFee: 'DailyLateFeeAccrualJob',
  chequeMaturity: 'ChequeMaturityReminderJob',
  dynamicPricing: 'DynamicPricingRevaluationJob',
  chequeBounced: 'ChequeBouncedJob',
  subcontractWorkflow: 'SubcontractorInvoiceWorkflowJob',
  unitCancellation: 'UnitCancellationReleasedJob',
} as const;

export const AUTOMATION_SETTING_KEYS = {
  autoReprice: 'RealEstateAutoReprice',
  crmInventoryWebhookUrl: 'CrmInventoryWebhookUrl',
} as const;
