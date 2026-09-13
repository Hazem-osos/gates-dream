import type { AccountRef, AccountSlotKey, TaxAccountSlotKey } from './account-definition-map';

export type AccountingSettingsActor = {
  companyId: string;
  userId: string;
  branchId?: string | null;
};

export type AccountingSettingsGeneral = {
  fiscalYearStart: string | null;
  fiscalYearEnd: string | null;
  defaultCurrency: string | null;
  journalEntryDigits: number;
  decimalsInAmounts: number;
  accountsGuideDigits: number | null;
  costCentersGuideDigits: number | null;
  storesGuideDigits: number | null;
  itemsGuideDigits: number | null;
  dateUsage: string | null;
  operationsFromDate: string | null;
  dueSecuritiesWarningDays: number | null;
  lockPostingBeforeDate: string | null;
  autoNumbering: boolean;
  costMethod: string | null;
  pricingCalculationBasis: string;
  backupPath: string | null;
  theme: string | null;
  temporaryReceipts: boolean;
  documentaryCredits: boolean;
  executiveWhatsAppPhone: string | null;
  autoPostGl: boolean;
  retainedEarningsAccountId: string | null;
};

export type AccountingSettingsControls = {
  enableApprovalsWorkflow: boolean;
  allowNegativeBalance: boolean;
  preventNegativeStock: boolean;
  preventCashOverdraft: boolean;
  noSellBelowCost: boolean;
  requireCostCenterForExpenses: boolean;
  allowCostCenterWithoutAccount: boolean;
  defaultPaymentTermsDays: number | null;
  budgetAllowExceed: boolean;
  budgetWarnHalf: boolean;
  budgetWarnSame: boolean;
  budgetWarnExceed: boolean;
  budgetStopMessageOnly: boolean;
  budgetStopLedger: boolean;
  budgetStopOrigin: boolean;
  budgetStopBoth: boolean;
};

export type AccountingSettingsTax = Record<TaxAccountSlotKey, string | null> & {
  defaultVatRate: number;
  whtRate: number;
  whtThreshold: number | null;
  applyWithholding: boolean;
};

export type AccountingSettingsContracting = {
  contractingRevenueAccountCode: string | null;
  projectExpenseAccountCode: string | null;
  clientReceivableAccountCode: string | null;
  subcontractorPayableAccountCode: string | null;
  customerAdvanceAccountCode: string | null;
  subcontractorAdvanceAccountCode: string | null;
  retentionHeldByOthersAccountCode: string | null;
  retentionWithheldForOthersAccountCode: string | null;
  penaltiesExpenseAccountCode: string | null;
  outputVatAccountCode: string | null;
  inputVatAccountCode: string | null;
  whtAssetAccountCode: string | null;
  whtPayableAccountCode: string | null;
  defaultVatRate: number;
  defaultWhtRate: number;
};

export type AccountingSettingsFacade = {
  general: AccountingSettingsGeneral;
  controls: AccountingSettingsControls;
  tax: AccountingSettingsTax;
  accounts: Record<AccountSlotKey, string | null>;
  contracting: AccountingSettingsContracting;
  statementLayouts: {
    incomeStatementSettings: unknown;
    financialPositionSettings: unknown;
  };
  accountDetails: Record<string, AccountRef | null>;
};
