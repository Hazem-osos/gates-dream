export type AccountRef = {
  id: string;
  code: string;
  arabicName: string;
};

export type AccountingAccountSlotKey =
  | 'salesAccountId'
  | 'salesReturnAccountId'
  | 'cogsAccountId'
  | 'inventoryAccountId'
  | 'purchaseAccountId'
  | 'purchaseReturnAccountId'
  | 'salesDiscountAccountId'
  | 'purchaseDiscountAccountId'
  | 'cashDiscountAllowedAccountId'
  | 'cashDiscountReceivedAccountId'
  | 'arAccountId'
  | 'apAccountId'
  | 'cashAccountId'
  | 'bankAccountId'
  | 'chequesUnderCollectionAccountId'
  | 'chequesPayableAccountId'
  | 'returnedChequesAccountId'
  | 'customerAdvanceAccountId'
  | 'supplierAdvanceAccountId'
  | 'fxGainAccountId'
  | 'fxLossAccountId'
  | 'exchangeGainLossAccountId'
  | 'roundingDifferenceAccountId'
  | 'stocktakingSurplusAccountId'
  | 'stocktakingDeficitAccountId'
  | 'assemblyExtraCostAccountId'
  | 'openingInventoryAccountId'
  | 'closingInventoryAccountId'
  | 'giftsAccountId'
  | 'transferAccountId';

export type AccountingTaxAccountKey =
  | 'salesTaxAccountId'
  | 'vatInputAccountId'
  | 'whtPayableAccountId'
  | 'whtReceivableAccountId';

export type AccountingSettingsFacade = {
  general: {
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
    coaAutoNumbering: boolean;
    costCenterAutoNumbering: boolean;
    itemAutoNumbering: boolean;
    numberingRecordCounts?: {
      accounts: number;
      costCenters: number;
      items: number;
    };
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
  controls: {
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
  tax: Record<AccountingTaxAccountKey, string | null> & {
    defaultVatRate: number;
    whtRate: number;
    whtThreshold: number | null;
    applyWithholding: boolean;
  };
  accounts: Record<AccountingAccountSlotKey, string | null>;
  contracting: Record<string, string | number | null>;
  statementLayouts: {
    incomeStatementSettings: unknown;
    financialPositionSettings: unknown;
  };
  accountDetails: Record<string, AccountRef | null>;
};

export type AccountingSettingsPutBody = {
  general?: Partial<AccountingSettingsFacade['general']>;
  controls?: Partial<AccountingSettingsFacade['controls']> & {
    preventSellingBelowCost?: boolean;
    enforceCostCenterForPnl?: boolean;
  };
  tax?: Partial<AccountingSettingsFacade['tax']>;
  accounts?: Partial<AccountingSettingsFacade['accounts']>;
};
