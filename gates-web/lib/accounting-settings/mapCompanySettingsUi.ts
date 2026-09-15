/** Maps API company settings row ↔ local UI state for `company-settings/accounting-settings`. */

const ADV_KEYS = [
  'adv_showPermissions',
  'adv_applyWithholding',
  'adv_applySupportedOrNot',
  'adv_useGregorian',
  'adv_showBothDates',
  'adv_directEffectOnVouchers',
] as const;

export type AccountingSettingsUiState = {
  fiscalYearStart: string;
  fiscalYearEnd: string;
  defaultCurrency: string;
  journalEntryDigits: number;
  allowNegativeBalance: boolean;
  allowCostCenterWithoutAccount: boolean;
  lockPostingBeforeDate: string;
  enableApprovalsWorkflow: boolean;
  autoNumbering: boolean;
  coaAutoNumbering: boolean;
  costCenterAutoNumbering: boolean;
  itemAutoNumbering: boolean;
  decimalsInAmounts: number;
  accountsGuideDigits: number;
  costCentersGuideDigits: number;
  storesGuideDigits: number;
  itemsGuideDigits: number;
  dateUsage: 'gregorian' | 'hijri' | 'both';
  operationsFromDate: string;
  dueSecuritiesWarningDays: number;
  budgetAllowExceed: boolean;
  budgetWarnHalf: boolean;
  budgetWarnSame: boolean;
  budgetWarnExceed: boolean;
  budgetStopMessageOnly: boolean;
  budgetStopLedger: boolean;
  budgetStopOrigin: boolean;
  budgetStopBoth: boolean;
  backupPath: string;
  costMethod: 'average' | 'fifo' | 'lifo';
  theme: 'light' | 'dark';
  temporaryReceipts: boolean;
  documentaryCredits: boolean;
  adv_showPermissions: boolean;
  adv_applyWithholding: boolean;
  adv_applySupportedOrNot: boolean;
  adv_useGregorian: boolean;
  adv_showBothDates: boolean;
  adv_directEffectOnVouchers: boolean;
  executiveWhatsAppPhone: string;
  pricingCalculationBasis: 'SELECTED_UNIT_QTY' | 'BASE_UNIT_QTY';
};

export const defaultAccountingSettingsUi = (): AccountingSettingsUiState => ({
  fiscalYearStart: '01-01-2025',
  fiscalYearEnd: '31-12-2025',
  defaultCurrency: 'EGP',
  journalEntryDigits: 6,
  allowNegativeBalance: false,
  allowCostCenterWithoutAccount: false,
  lockPostingBeforeDate: '',
  enableApprovalsWorkflow: true,
  autoNumbering: true,
  coaAutoNumbering: true,
  costCenterAutoNumbering: true,
  itemAutoNumbering: true,
  decimalsInAmounts: 2,
  accountsGuideDigits: 1,
  costCentersGuideDigits: 1,
  storesGuideDigits: 1,
  itemsGuideDigits: 1,
  dateUsage: 'hijri',
  operationsFromDate: '26-11-2025',
  dueSecuritiesWarningDays: 1,
  budgetAllowExceed: false,
  budgetWarnHalf: false,
  budgetWarnSame: false,
  budgetWarnExceed: false,
  budgetStopMessageOnly: false,
  budgetStopLedger: false,
  budgetStopOrigin: false,
  budgetStopBoth: false,
  backupPath: 'D://BACKUP',
  costMethod: 'average',
  theme: 'light',
  temporaryReceipts: false,
  documentaryCredits: false,
  adv_showPermissions: false,
  adv_applyWithholding: false,
  adv_applySupportedOrNot: false,
  adv_useGregorian: false,
  adv_showBothDates: false,
  adv_directEffectOnVouchers: false,
  executiveWhatsAppPhone: '',
  pricingCalculationBasis: 'SELECTED_UNIT_QTY',
});

export function mapApiToAccountingSettingsUi(api: Record<string, unknown>): AccountingSettingsUiState {
  const base = defaultAccountingSettingsUi();
  const advObj =
    api.advancedSettings && typeof api.advancedSettings === 'object'
      ? (api.advancedSettings as Record<string, unknown>)
      : {};

  const du = api.dateUsage;
  const dateUsage =
    du === 'gregorian' || du === 'hijri' || du === 'both' ? du : base.dateUsage;

  const cm = api.costMethod;
  const costMethod = cm === 'average' || cm === 'fifo' || cm === 'lifo' ? cm : base.costMethod;

  const th = api.theme;
  const theme = th === 'light' || th === 'dark' ? th : base.theme;

  const next: AccountingSettingsUiState = {
    ...base,
    fiscalYearStart: (api.fiscalYearStart as string) ?? base.fiscalYearStart,
    fiscalYearEnd: (api.fiscalYearEnd as string) ?? base.fiscalYearEnd,
    defaultCurrency: (api.defaultCurrency as string) ?? base.defaultCurrency,
    journalEntryDigits: (api.journalEntryDigits as number) ?? base.journalEntryDigits,
    allowNegativeBalance: Boolean(api.allowNegativeBalance ?? base.allowNegativeBalance),
    allowCostCenterWithoutAccount: Boolean(
      api.allowCostCenterWithoutAccount ?? base.allowCostCenterWithoutAccount
    ),
    lockPostingBeforeDate: (api.lockPostingBeforeDate as string) ?? base.lockPostingBeforeDate,
    enableApprovalsWorkflow: Boolean(api.enableApprovalsWorkflow ?? base.enableApprovalsWorkflow),
    autoNumbering: Boolean(api.autoNumbering ?? base.autoNumbering),
    coaAutoNumbering: api.coaAutoNumbering !== false,
    costCenterAutoNumbering: api.costCenterAutoNumbering !== false,
    itemAutoNumbering: api.itemAutoNumbering !== false,
    decimalsInAmounts: (api.decimalsInAmounts as number) ?? base.decimalsInAmounts,
    accountsGuideDigits: (api.accountsGuideDigits as number) ?? base.accountsGuideDigits,
    costCentersGuideDigits: (api.costCentersGuideDigits as number) ?? base.costCentersGuideDigits,
    storesGuideDigits: (api.storesGuideDigits as number) ?? base.storesGuideDigits,
    itemsGuideDigits: (api.itemsGuideDigits as number) ?? base.itemsGuideDigits,
    dateUsage,
    operationsFromDate: (api.operationsFromDate as string) ?? base.operationsFromDate,
    dueSecuritiesWarningDays: (api.dueSecuritiesWarningDays as number) ?? base.dueSecuritiesWarningDays,
    budgetAllowExceed: Boolean(api.budgetAllowExceed ?? base.budgetAllowExceed),
    budgetWarnHalf: Boolean(api.budgetWarnHalf ?? base.budgetWarnHalf),
    budgetWarnSame: Boolean(api.budgetWarnSame ?? base.budgetWarnSame),
    budgetWarnExceed: Boolean(api.budgetWarnExceed ?? base.budgetWarnExceed),
    budgetStopMessageOnly: Boolean(api.budgetStopMessageOnly ?? base.budgetStopMessageOnly),
    budgetStopLedger: Boolean(api.budgetStopLedger ?? base.budgetStopLedger),
    budgetStopOrigin: Boolean(api.budgetStopOrigin ?? base.budgetStopOrigin),
    budgetStopBoth: Boolean(api.budgetStopBoth ?? base.budgetStopBoth),
    backupPath: (api.backupPath as string) ?? base.backupPath,
    costMethod,
    theme,
    temporaryReceipts: Boolean(api.temporaryReceipts ?? base.temporaryReceipts),
    documentaryCredits: Boolean(api.documentaryCredits ?? base.documentaryCredits),
    executiveWhatsAppPhone: (api.executiveWhatsAppPhone as string) ?? base.executiveWhatsAppPhone,
    pricingCalculationBasis:
      api.pricingCalculationBasis === 'BASE_UNIT_QTY' ? 'BASE_UNIT_QTY' : 'SELECTED_UNIT_QTY',
  };

  const advTarget = next as unknown as Record<string, boolean>;
  for (const k of ADV_KEYS) {
    advTarget[k] = Boolean(advObj[k] ?? advTarget[k]);
  }

  return next;
}

export function accountingSettingsUiToPayload(
  s: AccountingSettingsUiState,
  existingAdvanced?: Record<string, unknown>
) {
  const advancedSettings: Record<string, unknown> = { ...existingAdvanced };
  const advSrc = s as unknown as Record<string, boolean>;
  for (const k of ADV_KEYS) {
    advancedSettings[k] = advSrc[k];
  }

  return {
    fiscalYearStart: s.fiscalYearStart,
    fiscalYearEnd: s.fiscalYearEnd,
    defaultCurrency: s.defaultCurrency,
    journalEntryDigits: s.journalEntryDigits,
    allowNegativeBalance: s.allowNegativeBalance,
    allowCostCenterWithoutAccount: s.allowCostCenterWithoutAccount,
    lockPostingBeforeDate: s.lockPostingBeforeDate || undefined,
    enableApprovalsWorkflow: s.enableApprovalsWorkflow,
    autoNumbering: s.autoNumbering,
    decimalsInAmounts: s.decimalsInAmounts,
    accountsGuideDigits: s.accountsGuideDigits,
    costCentersGuideDigits: s.costCentersGuideDigits,
    storesGuideDigits: s.storesGuideDigits,
    itemsGuideDigits: s.itemsGuideDigits,
    dateUsage: s.dateUsage,
    operationsFromDate: s.operationsFromDate,
    dueSecuritiesWarningDays: s.dueSecuritiesWarningDays,
    budgetAllowExceed: s.budgetAllowExceed,
    budgetWarnHalf: s.budgetWarnHalf,
    budgetWarnSame: s.budgetWarnSame,
    budgetWarnExceed: s.budgetWarnExceed,
    budgetStopMessageOnly: s.budgetStopMessageOnly,
    budgetStopLedger: s.budgetStopLedger,
    budgetStopOrigin: s.budgetStopOrigin,
    budgetStopBoth: s.budgetStopBoth,
    backupPath: s.backupPath,
    costMethod: s.costMethod,
    theme: s.theme,
    temporaryReceipts: s.temporaryReceipts,
    documentaryCredits: s.documentaryCredits,
    executiveWhatsAppPhone: s.executiveWhatsAppPhone.trim() || null,
    pricingCalculationBasis: s.pricingCalculationBasis,
    advancedSettings,
  };
}
