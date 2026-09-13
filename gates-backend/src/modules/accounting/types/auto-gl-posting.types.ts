import type { JournalEntryLineData } from './journal-entry.types';
import type { JournalPostingContext } from '../services/journal-posting.service';

/** Canonical Auto-GL document families (mapped to short JE `sourceType`). */
export const AUTO_GL_SOURCE = {
  SALES_INVOICE: 'SI',
  PURCHASE_INVOICE: 'PI',
  SALE_RETURN: 'SR',
  PURCHASE_RETURN: 'PR',
  TREASURY_RECEIPT: 'CR',
  TREASURY_PAYMENT: 'CP',
  CONTRACTOR_EXTRACT_PAYMENT: 'CEP',
  CHECK_COLLECT: 'CKC',
  CHECK_BOUNCE: 'CKB',
  CHECK_ENDORSE: 'CKE',
} as const;

export type AutoGlSourceName = keyof typeof AUTO_GL_SOURCE;
export type AutoGlSourceType = (typeof AUTO_GL_SOURCE)[AutoGlSourceName] | string;

export const GL_BALANCE_EPSILON = 0.001;

export interface AutoGlPostingContext extends JournalPostingContext {
  fiscalYearId: string;
}

export interface AutoGlCommitInput {
  sourceType: AutoGlSourceType;
  sourceId: string;
  sourceNumber?: string;
  sourceYearId?: string;
  date: Date;
  hijriDate?: string;
  description?: string;
  currencyCode: string;
  exchangeRate?: number;
  fiscalYearId: string;
  legacyGlNum?: string;
  entryType?: string;
  lines: JournalEntryLineData[];
  costCenterId?: string | null;
  /** When false, skip company `autoPostGl` (explicit post still honors `GLPost`). */
  requireAutoPostFlag?: boolean;
}

export interface AutoGlPostDocumentInput {
  sourceType: AutoGlSourceName | AutoGlSourceType;
  sourceId: string;
  costCenterId?: string | null;
  /** Point-in-time inventory valuation from InventoryCostingService (COGS). */
  cogsAmount?: number;
}

export interface ResolvedCompanyGlAccounts {
  arAccountId?: string;
  apAccountId?: string;
  cashAccountId?: string;
  bankAccountId?: string;
  inventoryAccountId?: string;
  salesAccountId?: string;
  cogsAccountId?: string;
  vatOutputAccountId?: string;
  vatInputAccountId?: string;
  withholdingAccountId?: string;
  purchaseAccountId?: string;
  salesReturnAccountId?: string;
  salesDiscountAccountId?: string;
  roundingAccountId?: string;
  returnedChequesAccountId?: string;
  chequesUnderCollectionAccountId?: string;
  fxGainAccountId?: string;
  fxLossAccountId?: string;
  contractorAccountId?: string;
  retentionAccountId?: string;
  advanceAccountId?: string;
}
