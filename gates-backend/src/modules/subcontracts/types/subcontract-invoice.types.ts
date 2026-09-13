import type { Decimal } from '@prisma/client/runtime/library';
import type { SubcontractInvoiceType } from '@prisma/client';

export const HISTORICAL_INVOICE_STATUSES = [
  'CONSULTANT_APPROVED',
  'TECH_OFFICE_APPROVED',
  'FINANCE_POSTED',
  'PAID',
] as const;

export const IMMUTABLE_INVOICE_STATUSES = ['FINANCE_POSTED', 'PAID'] as const;

export interface DraftInvoiceLineInput {
  subcontractBOQItemId: string;
  currentQuantity: Decimal.Value;
}

export interface CalculateDraftInvoiceParams {
  companyId: string;
  subcontractId: string;
  items: DraftInvoiceLineInput[];
  applyEarlyPaymentDiscount?: boolean;
  /** When recalculating an existing draft, exclude it from the historical baseline. */
  excludeInvoiceId?: string;
}

export interface CalculatedInvoiceLine {
  subcontractBOQItemId: string;
  itemCode: string;
  previousQuantity: Decimal;
  currentQuantity: Decimal;
  totalCumulativeQuantity: Decimal;
  completionPercentage: Decimal;
  unitPrice: Decimal;
  totalCurrentAmount: Decimal;
  maxAllowedQuantity: Decimal;
  contractQuantity: Decimal;
}

export interface CalculatedInvoiceDeductions {
  advancePaymentDeduction: Decimal;
  remainingAdvanceBalanceBefore: Decimal;
  remainingAdvanceBalanceAfter: Decimal;
  retentionDeduction: Decimal;
  taxWithholdingDeduction: Decimal;
  socialInsuranceDeduction: Decimal;
  materialOveruseDeduction: Decimal;
  sitePenaltiesDeduction: Decimal;
  directExecutionDeduction: Decimal;
  earlyPaymentDiscountDeduction: Decimal;
}

export interface CalculatedDraftInvoice {
  subcontractId: string;
  previousGrossAmount: Decimal;
  grossCurrentAmount: Decimal;
  grossCumulativeAmount: Decimal;
  deductions: CalculatedInvoiceDeductions;
  netPayableAmount: Decimal;
  lines: CalculatedInvoiceLine[];
  pendingMaterialLogIds: string[];
  pendingPenaltyIds: string[];
  pendingDirectChargeIds: string[];
  applyEarlyPaymentDiscount: boolean;
}

export interface CreateOrUpdateDraftInvoiceDto {
  invoiceId?: string;
  invoiceNumber?: string;
  sequenceNumber?: number;
  periodStartDate: Date;
  periodEndDate: Date;
  type?: SubcontractInvoiceType;
  items: DraftInvoiceLineInput[];
  applyEarlyPaymentDiscount?: boolean;
  notes?: string | null;
  attachments?: unknown;
}

export interface SubcontractInvoiceGlPayload {
  sourceType: 'SUBCONTRACT_INVOICE';
  companyId: string;
  invoiceId: string;
  subcontractId: string;
  invoiceNumber: string;
  sequenceNumber: number;
  type: SubcontractInvoiceType;
  amounts: {
    grossCurrentAmount: Decimal;
    grossCumulativeAmount: Decimal;
    previousGrossAmount: Decimal;
    advancePaymentDeduction: Decimal;
    retentionDeduction: Decimal;
    taxWithholdingDeduction: Decimal;
    socialInsuranceDeduction: Decimal;
    materialOveruseDeduction: Decimal;
    sitePenaltiesDeduction: Decimal;
    directExecutionDeduction: Decimal;
    earlyPaymentDiscountDeduction: Decimal;
    netPayableAmount: Decimal;
  };
}

export interface CalculateMaterialOveruseParams {
  companyId: string;
  subcontractId: string;
  materialId: string;
  warehouseIssueSlipNumber?: string;
  standardEngineeredQty: Decimal.Value;
  actualIssuedQty: Decimal.Value;
  marketPricePerUnit: Decimal.Value;
}

export interface MaterialOverusePenaltyResult {
  subcontractId: string;
  itemId: string;
  warehouseIssueSlipNumber: string | null;
  standardEngineeredQty: Decimal;
  actualIssuedQty: Decimal;
  allowedThreshold: Decimal;
  scrapExcessQty: Decimal;
  rawPenalty: Decimal;
  overheadAmount: Decimal;
  adminOverheadPercentage: Decimal;
  totalPenaltyAmount: Decimal;
  logId: string | null;
}
