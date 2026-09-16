import type { AccountingSettingsUiState } from './mapCompanySettingsUi';
import { defaultAccountingSettingsUi } from './mapCompanySettingsUi';
import type {
  AccountingAccountSlotKey,
  AccountingSettingsFacade,
  AccountingSettingsPutBody,
  AccountingTaxAccountKey,
  AccountRef,
} from './accounting-settings.types';

export const ACCOUNT_SLOT_LABELS: Array<{ key: AccountingAccountSlotKey; label: string }> = [
  { key: 'salesAccountId', label: 'المبيعات' },
  { key: 'salesReturnAccountId', label: 'مردودات المبيعات' },
  { key: 'salesDiscountAccountId', label: 'خصم مسموح به' },
  { key: 'cashDiscountAllowedAccountId', label: 'خصم نقدي مسموح به' },
  { key: 'cogsAccountId', label: 'تكلفة البضاعة' },
  { key: 'inventoryAccountId', label: 'المخزون' },
  { key: 'purchaseAccountId', label: 'المشتريات' },
  { key: 'purchaseReturnAccountId', label: 'مردودات المشتريات' },
  { key: 'purchaseDiscountAccountId', label: 'خصم مكتسب' },
  { key: 'cashDiscountReceivedAccountId', label: 'خصم نقدي مكتسب' },
  { key: 'giftsAccountId', label: 'الهدايا' },
  { key: 'openingInventoryAccountId', label: 'بضاعة أول المدة' },
  { key: 'closingInventoryAccountId', label: 'بضاعة آخر المدة' },
  { key: 'stocktakingDeficitAccountId', label: 'حساب عجز الأصناف' },
  { key: 'stocktakingSurplusAccountId', label: 'حساب زيادة الجرد' },
  { key: 'assemblyExtraCostAccountId', label: 'تكلفة إضافية للتجميع' },
  { key: 'transferAccountId', label: 'حساب النقل' },
  { key: 'arAccountId', label: 'العملاء' },
  { key: 'apAccountId', label: 'الموردين / الدائنون' },
  { key: 'cashAccountId', label: 'الصناديق / المقبوضات' },
  { key: 'bankAccountId', label: 'البنوك' },
  { key: 'chequesUnderCollectionAccountId', label: 'أوراق القبض تحت التحصيل' },
  { key: 'chequesPayableAccountId', label: 'أوراق الدفع' },
  { key: 'returnedChequesAccountId', label: 'شيكات مرتدة' },
  { key: 'customerAdvanceAccountId', label: 'دفعات مقدمة من العملاء' },
  { key: 'supplierAdvanceAccountId', label: 'دفعات مقدمة للموردين' },
  { key: 'roundingDifferenceAccountId', label: 'فروق التقريب' },
  { key: 'fxGainAccountId', label: 'أرباح أسعار الصرف' },
  { key: 'fxLossAccountId', label: 'خسائر أسعار الصرف' },
  { key: 'exchangeGainLossAccountId', label: 'أرباح/خسائر الصرف (موحّد)' },
];

export const TAX_SLOT_LABELS: Array<{ key: AccountingTaxAccountKey; label: string }> = [
  { key: 'salesTaxAccountId', label: 'ضريبة المبيعات / ضريبة دائن' },
  { key: 'vatInputAccountId', label: 'ضريبة مدين' },
  { key: 'whtPayableAccountId', label: 'خصم المنبع دائن' },
  { key: 'whtReceivableAccountId', label: 'خصم المنبع مدين' },
];

export type AccountingSettingsFormState = AccountingSettingsUiState & {
  autoPostGl: boolean;
  inventorySystem: 'PERPETUAL' | 'PERIODIC';
  preventNegativeStock: boolean;
  preventCashOverdraft: boolean;
  preventSellingBelowCost: boolean;
  enforceCostCenterForPnl: boolean;
  retainedEarningsAccountId: string;
  accounts: Record<AccountingAccountSlotKey, string>;
  taxAccounts: Record<AccountingTaxAccountKey, string>;
  accountDetails: Record<string, AccountRef | null>;
};

const EMPTY_ACCOUNTS = ACCOUNT_SLOT_LABELS.reduce(
  (acc, slot) => {
    acc[slot.key] = '';
    return acc;
  },
  {} as Record<AccountingAccountSlotKey, string>
);

const EMPTY_TAX = TAX_SLOT_LABELS.reduce(
  (acc, slot) => {
    acc[slot.key] = '';
    return acc;
  },
  {} as Record<AccountingTaxAccountKey, string>
);

export function defaultAccountingSettingsForm(): AccountingSettingsFormState {
  return {
    ...defaultAccountingSettingsUi(),
    autoPostGl: true,
    inventorySystem: 'PERPETUAL',
    preventNegativeStock: true,
    preventCashOverdraft: true,
    preventSellingBelowCost: false,
    enforceCostCenterForPnl: false,
    retainedEarningsAccountId: '',
    accounts: { ...EMPTY_ACCOUNTS },
    taxAccounts: { ...EMPTY_TAX },
    accountDetails: {},
  };
}

function str(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function mapFacadeToForm(facade: AccountingSettingsFacade): AccountingSettingsFormState {
  const base = defaultAccountingSettingsForm();
  const g = facade.general;
  const c = facade.controls;
  const accounts = { ...base.accounts };
  const taxAccounts = { ...base.taxAccounts };

  for (const slot of ACCOUNT_SLOT_LABELS) {
    accounts[slot.key] = str(facade.accounts?.[slot.key]);
  }
  for (const slot of TAX_SLOT_LABELS) {
    taxAccounts[slot.key] = str(facade.tax?.[slot.key]);
  }

  const dateUsage =
    g.dateUsage === 'gregorian' || g.dateUsage === 'hijri' || g.dateUsage === 'both'
      ? g.dateUsage
      : base.dateUsage;

  return {
    ...base,
    fiscalYearStart: g.fiscalYearStart ?? base.fiscalYearStart,
    fiscalYearEnd: g.fiscalYearEnd ?? base.fiscalYearEnd,
    defaultCurrency: g.defaultCurrency ?? base.defaultCurrency,
    journalEntryDigits: g.journalEntryDigits ?? base.journalEntryDigits,
    decimalsInAmounts: g.decimalsInAmounts ?? base.decimalsInAmounts,
    accountsGuideDigits: g.accountsGuideDigits ?? base.accountsGuideDigits,
    costCentersGuideDigits: g.costCentersGuideDigits ?? base.costCentersGuideDigits,
    storesGuideDigits: g.storesGuideDigits ?? base.storesGuideDigits,
    itemsGuideDigits: g.itemsGuideDigits ?? base.itemsGuideDigits,
    dateUsage,
    operationsFromDate: g.operationsFromDate ?? base.operationsFromDate,
    dueSecuritiesWarningDays: g.dueSecuritiesWarningDays ?? base.dueSecuritiesWarningDays,
    lockPostingBeforeDate: g.lockPostingBeforeDate ?? '',
    autoNumbering: g.autoNumbering ?? true,
    coaAutoNumbering: g.coaAutoNumbering !== false,
    costCenterAutoNumbering: g.costCenterAutoNumbering !== false,
    itemAutoNumbering: g.itemAutoNumbering !== false,
    costMethod: 'average',
    pricingCalculationBasis:
      g.pricingCalculationBasis === 'BASE_UNIT_QTY' ? 'BASE_UNIT_QTY' : 'SELECTED_UNIT_QTY',
    backupPath: g.backupPath ?? base.backupPath,
    theme: g.theme === 'dark' ? 'dark' : 'light',
    temporaryReceipts: g.temporaryReceipts ?? false,
    documentaryCredits: g.documentaryCredits ?? false,
    executiveWhatsAppPhone: g.executiveWhatsAppPhone ?? '',
    autoPostGl: g.autoPostGl ?? true,
    inventorySystem: g.inventorySystem === 'PERIODIC' ? 'PERIODIC' : 'PERPETUAL',
    retainedEarningsAccountId: str(g.retainedEarningsAccountId),
    allowNegativeBalance: c.allowNegativeBalance ?? false,
    allowCostCenterWithoutAccount: c.allowCostCenterWithoutAccount ?? false,
    enableApprovalsWorkflow: c.enableApprovalsWorkflow ?? true,
    preventNegativeStock: c.preventNegativeStock ?? true,
    preventCashOverdraft: c.preventCashOverdraft ?? true,
    preventSellingBelowCost: c.noSellBelowCost ?? false,
    enforceCostCenterForPnl: c.requireCostCenterForExpenses ?? false,
    budgetAllowExceed: c.budgetAllowExceed ?? false,
    budgetWarnHalf: c.budgetWarnHalf ?? false,
    budgetWarnSame: c.budgetWarnSame ?? false,
    budgetWarnExceed: c.budgetWarnExceed ?? false,
    budgetStopMessageOnly: c.budgetStopMessageOnly ?? false,
    budgetStopLedger: c.budgetStopLedger ?? false,
    budgetStopOrigin: c.budgetStopOrigin ?? false,
    budgetStopBoth: c.budgetStopBoth ?? false,
    adv_applyWithholding: facade.tax?.applyWithholding ?? false,
    accounts,
    taxAccounts,
    accountDetails: facade.accountDetails ?? {},
  };
}

export function formToPutPayload(form: AccountingSettingsFormState): AccountingSettingsPutBody {
  const accounts: Partial<AccountingSettingsFacade['accounts']> = {};
  for (const slot of ACCOUNT_SLOT_LABELS) {
    accounts[slot.key] = form.accounts[slot.key] || null;
  }

  return {
    general: {
      fiscalYearStart: form.fiscalYearStart || null,
      fiscalYearEnd: form.fiscalYearEnd || null,
      defaultCurrency: form.defaultCurrency || null,
      journalEntryDigits: form.journalEntryDigits,
      decimalsInAmounts: form.decimalsInAmounts,
      accountsGuideDigits: form.accountsGuideDigits,
      costCentersGuideDigits: form.costCentersGuideDigits,
      storesGuideDigits: form.storesGuideDigits,
      itemsGuideDigits: form.itemsGuideDigits,
      dateUsage: form.dateUsage,
      operationsFromDate: form.operationsFromDate || null,
      dueSecuritiesWarningDays: form.dueSecuritiesWarningDays,
      lockPostingBeforeDate: form.lockPostingBeforeDate || null,
      autoNumbering: form.autoNumbering,
      coaAutoNumbering: form.coaAutoNumbering !== false,
      costCenterAutoNumbering: form.costCenterAutoNumbering !== false,
      itemAutoNumbering: form.itemAutoNumbering !== false,
      costMethod: 'average',
      pricingCalculationBasis: form.pricingCalculationBasis,
      backupPath: form.backupPath || null,
      theme: form.theme,
      temporaryReceipts: form.temporaryReceipts,
      documentaryCredits: form.documentaryCredits,
      executiveWhatsAppPhone: form.executiveWhatsAppPhone.trim() || null,
      autoPostGl: form.autoPostGl,
      inventorySystem: form.inventorySystem,
      retainedEarningsAccountId: form.retainedEarningsAccountId || null,
    },
    controls: {
      enableApprovalsWorkflow: form.enableApprovalsWorkflow,
      allowNegativeBalance: form.allowNegativeBalance,
      allowCostCenterWithoutAccount: form.allowCostCenterWithoutAccount,
      preventNegativeStock: form.preventNegativeStock,
      preventCashOverdraft: form.preventCashOverdraft,
      preventSellingBelowCost: form.preventSellingBelowCost,
      noSellBelowCost: form.preventSellingBelowCost,
      enforceCostCenterForPnl: form.enforceCostCenterForPnl,
      requireCostCenterForExpenses: form.enforceCostCenterForPnl,
      budgetAllowExceed: form.budgetAllowExceed,
      budgetWarnHalf: form.budgetWarnHalf,
      budgetWarnSame: form.budgetWarnSame,
      budgetWarnExceed: form.budgetWarnExceed,
      budgetStopMessageOnly: form.budgetStopMessageOnly,
      budgetStopLedger: form.budgetStopLedger,
      budgetStopOrigin: form.budgetStopOrigin,
      budgetStopBoth: form.budgetStopBoth,
    },
    tax: {
      applyWithholding: form.adv_applyWithholding,
      salesTaxAccountId: form.taxAccounts.salesTaxAccountId || null,
      vatInputAccountId: form.taxAccounts.vatInputAccountId || null,
      whtPayableAccountId: form.taxAccounts.whtPayableAccountId || null,
      whtReceivableAccountId: form.taxAccounts.whtReceivableAccountId || null,
    },
    accounts,
  };
}

export function accountDetailFor(
  details: Record<string, AccountRef | null>,
  accountId: string | null | undefined
): AccountRef | null {
  if (!accountId) return null;
  return details[accountId] ?? details[`${accountId}`] ?? null;
}
