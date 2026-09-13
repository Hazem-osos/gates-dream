import type { ClientInvoiceType } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import type { DecimalInput } from '../../utils/money-decimal';

/** Certified / posted extracts that form the historical cumulative baseline. */
export const HISTORICAL_CLIENT_INVOICE_STATUSES = [
  'CLIENT_APPROVED',
  'FINANCE_POSTED',
  'PAID',
] as const;

export const IMMUTABLE_CLIENT_INVOICE_STATUSES = ['FINANCE_POSTED', 'PAID'] as const;

export interface DraftClientInvoiceLineInput {
  projectBOQItemId: string;
  currentQuantity: DecimalInput;
}

export interface CalculateDraftClientInvoiceDto {
  items: DraftClientInvoiceLineInput[];
  otherClientPenalties?: DecimalInput;
  /** Claim these STORED_ON_SITE rows this period. Default: all unlinked stored stock. */
  claimSiteStockMaterialIds?: string[];
  /** Previously claimed stock now installed and deducted this period. */
  installSiteStockMaterialIds?: string[];
  /** Allow cumulative qty above contractQuantity (approved variation order). */
  allowVariationOrder?: boolean;
  /** When recalculating an existing draft, exclude it from the historical baseline. */
  excludeInvoiceId?: string;
}

export interface CalculatedClientInvoiceLine {
  projectBOQItemId: string;
  itemCode: string;
  previousQuantity: Decimal;
  currentQuantity: Decimal;
  cumulativeQuantity: Decimal;
  unitSellingPrice: Decimal;
  currentAmount: Decimal;
  contractQuantity: Decimal;
}

export interface CalculatedMaterialsOnSite {
  materialsOnSiteCurrent: Decimal;
  materialsOnSiteDeduction: Decimal;
  netMaterialsOnSite: Decimal;
  claimedMaterialIds: string[];
  installedMaterialIds: string[];
}

export interface CalculatedClientInvoiceDeductions {
  advancePaymentRecovery: Decimal;
  remainingAdvanceBalanceBefore: Decimal;
  remainingAdvanceBalanceAfter: Decimal;
  retentionDeduction: Decimal;
  engineeringStampsDeduction: Decimal;
  otherClientPenalties: Decimal;
}

export interface CalculatedDraftClientInvoice {
  clientContractId: string;
  projectId: string;
  previousGrossWorks: Decimal;
  grossCurrentWorks: Decimal;
  cumulativeGrossWorks: Decimal;
  materials: CalculatedMaterialsOnSite;
  deductions: CalculatedClientInvoiceDeductions;
  netPayableByClient: Decimal;
  lines: CalculatedClientInvoiceLine[];
}

export interface CreateOrUpdateDraftClientInvoiceDto {
  invoiceId?: string;
  invoiceNumber?: string;
  sequenceNumber?: number;
  periodStartDate: Date;
  periodEndDate: Date;
  type?: ClientInvoiceType;
  items: DraftClientInvoiceLineInput[];
  otherClientPenalties?: DecimalInput;
  claimSiteStockMaterialIds?: string[];
  installSiteStockMaterialIds?: string[];
  allowVariationOrder?: boolean;
}

export interface ClientInvoiceGlPayload {
  sourceType: 'CLIENT_INVOICE';
  companyId: string;
  invoiceId: string;
  clientContractId: string;
  projectId: string;
  invoiceNumber: string;
  sequenceNumber: number;
  type: ClientInvoiceType;
  amounts: {
    grossCurrentWorks: Decimal;
    previousGrossWorks: Decimal;
    cumulativeGrossWorks: Decimal;
    materialsOnSiteCurrent: Decimal;
    materialsOnSiteDeduction: Decimal;
    netMaterialsOnSite: Decimal;
    advancePaymentRecovery: Decimal;
    retentionDeduction: Decimal;
    engineeringStampsDeduction: Decimal;
    otherClientPenalties: Decimal;
    netPayableByClient: Decimal;
  };
}
