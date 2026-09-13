import type { ProjectLgType } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import type { DecimalInput } from '../../utils/money-decimal';

export const ACTIVE_LG_STATUSES = ['ACTIVE_ISSUED', 'EXTENDED', 'AMENDED_VALUE'] as const;
export const CLOSED_LG_STATUSES = ['RELEASED_RETURNED', 'LIQUIDATED_CONFISCATED'] as const;

export interface IssueLetterOfGuaranteeDto {
  projectId: string;
  lgNumber: string;
  bankAccountId: string;
  bankName: string;
  beneficiaryName: string;
  type: ProjectLgType;
  issuanceDate: Date;
  expiryDate: Date;
  originalAmount: DecimalInput;
  cashMarginRate: DecimalInput;
  issuanceCommissionAmount?: DecimalInput;
  branchId?: string;
}

export interface ExtendLetterOfGuaranteeDto {
  newExpiryDate: Date;
  bankReferenceNo?: string;
  extensionCommission?: DecimalInput;
  notes?: string;
  branchId?: string;
}

export interface AmendLgAmountDto {
  newAmount: DecimalInput;
  bankReferenceNo?: string;
  notes?: string;
  branchId?: string;
}

export interface ReleaseLetterOfGuaranteeDto {
  releaseDate: Date;
  bankReferenceNo?: string;
  notes?: string;
  branchId?: string;
}

export interface LiquidateLetterOfGuaranteeDto {
  liquidationDate: Date;
  liquidationReason: string;
  notes?: string;
  branchId?: string;
}

export interface ProjectLgGlPayload {
  sourceType:
    | 'PROJECT_LG_ISSUANCE'
    | 'PROJECT_LG_EXTENSION'
    | 'PROJECT_LG_AMENDMENT'
    | 'PROJECT_LG_RELEASE'
    | 'PROJECT_LG_LIQUIDATION';
  companyId: string;
  lgId: string;
  lgNumber: string;
  journalEntryId: string;
  amounts: {
    originalAmount?: Decimal;
    currentAmount?: Decimal;
    cashMarginAmount?: Decimal;
    cashMarginDiff?: Decimal;
    commissionAmount?: Decimal;
  };
}
