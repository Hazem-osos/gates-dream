export type TransactionDocumentType =
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'PAYMENT_VOUCHER'
  | 'RECEIPT_VOUCHER'
  | 'STOCK_ISSUE'
  | 'STOCK_RECEIPT'
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN'
  | 'BANK_DEBIT_ADVICE'
  | 'BANK_CREDIT_ADVICE'
  | 'JOURNAL_ENTRY'
  | 'OPENING_BALANCE';

export type NumberingMode = 'AUTOMATIC' | 'MANUAL';
export type SequenceMode = 'CONTINUOUS' | 'ANNUAL_RESET';
export type PricingPolicy = 'COST' | 'LAST_PURCHASE' | 'LAST_SALE' | 'LAST_SALE_TO_CUSTOMER';
export type CostCenterPostingSide = 'DEBIT' | 'CREDIT';
export type CostCenterAllocationTarget = 'SALES' | 'COST_OF_GOODS_SOLD';

export type NamedRef = { id: string; code?: string | null; arabicName: string };

export type TransactionSettings = {
  id: string;
  companyId: string;
  documentType: TransactionDocumentType;
  numberingMode: NumberingMode;
  sequenceMode: SequenceMode;
  autoPostOnSave: boolean;
  autoPrintOnSave: boolean;
  generateEntryOnSave: boolean;
  affectStock: boolean;
  allowItemPriceOverride: boolean;
  preventSellingBelowCost: boolean;
  preventNegativeStock: boolean;
  autoApplyVat: boolean;
  autoApplyWht: boolean;
  autoApplyDevelopmentTax: boolean;
  cascadingDiscounts: boolean;
  showAllAccountsInCustomerField: boolean;
  defaultSalesAccountId: string | null;
  defaultPurchaseReturnAccountId: string | null;
  defaultCashAccountId: string | null;
  defaultBankGlAccountId: string | null;
  defaultOffsetAccountId: string | null;
  defaultChargesAccountId: string | null;
  defaultCostCenterId: string | null;
  defaultWarehouseId: string | null;
  pricingPolicy: PricingPolicy;
  costCenterSide: CostCenterPostingSide;
  costCenterAllocationTarget: CostCenterAllocationTarget;
  allowStandaloneReturns: boolean;
  enforceOriginalPrice: boolean;
  showFxColumns: boolean;
  defaultSalesAccount?: NamedRef | null;
  defaultPurchaseReturnAccount?: NamedRef | null;
  defaultCashAccount?: NamedRef | null;
  defaultBankGlAccount?: NamedRef | null;
  defaultOffsetAccount?: NamedRef | null;
  defaultChargesAccount?: NamedRef | null;
  defaultCostCenter?: NamedRef | null;
  defaultWarehouse?: NamedRef | null;
};

export const DOCUMENT_TYPE_SLUG: Record<string, TransactionDocumentType> = {
  'sales-invoice': 'SALES_INVOICE',
  'purchase-invoice': 'PURCHASE_INVOICE',
  'payment-voucher': 'PAYMENT_VOUCHER',
  'receipt-voucher': 'RECEIPT_VOUCHER',
  'stock-issue': 'STOCK_ISSUE',
  'stock-receipt': 'STOCK_RECEIPT',
  'sales-return': 'SALES_RETURN',
  'purchase-return': 'PURCHASE_RETURN',
  'bank-discount': 'BANK_DEBIT_ADVICE',
  'bank-addition': 'BANK_CREDIT_ADVICE',
  'journal-entry': 'JOURNAL_ENTRY',
  'opening-balance': 'OPENING_BALANCE',
};

export const DOCUMENT_TYPE_TITLE: Record<TransactionDocumentType, string> = {
  SALES_INVOICE: 'إعدادات فاتورة المبيعات',
  PURCHASE_INVOICE: 'إعدادات فاتورة المشتريات',
  PAYMENT_VOUCHER: 'إعدادات سند الصرف',
  RECEIPT_VOUCHER: 'إعدادات سند القبض',
  STOCK_ISSUE: 'إعدادات إذن الصرف',
  STOCK_RECEIPT: 'إعدادات إذن الإضافة',
  SALES_RETURN: 'إعدادات مردودات المبيعات',
  PURCHASE_RETURN: 'إعدادات مردودات المشتريات',
  BANK_DEBIT_ADVICE: 'إعدادات إشعار الخصم',
  BANK_CREDIT_ADVICE: 'إعدادات إشعار الإضافة',
  JOURNAL_ENTRY: 'إعدادات قيد اليومية',
  OPENING_BALANCE: 'إعدادات الرصيد الافتتاحي',
};

export type TransactionSettingsModule = 'inventory' | 'accounting';

export type TransactionSettingsContext = {
  slug: string;
  documentType: TransactionDocumentType;
  title: string;
  module: TransactionSettingsModule;
  moduleLabel: string;
  sourceHref: string;
  sourceLabel: string;
};

export const TRANSACTION_SETTINGS_CONTEXT: Record<
  TransactionDocumentType,
  TransactionSettingsContext
> = {
  SALES_INVOICE: {
    slug: 'sales-invoice',
    documentType: 'SALES_INVOICE',
    title: DOCUMENT_TYPE_TITLE.SALES_INVOICE,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/sales-invoice',
    sourceLabel: 'فاتورة المبيعات',
  },
  PURCHASE_INVOICE: {
    slug: 'purchase-invoice',
    documentType: 'PURCHASE_INVOICE',
    title: DOCUMENT_TYPE_TITLE.PURCHASE_INVOICE,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/final-purchase-invoice',
    sourceLabel: 'فاتورة المشتريات',
  },
  SALES_RETURN: {
    slug: 'sales-return',
    documentType: 'SALES_RETURN',
    title: DOCUMENT_TYPE_TITLE.SALES_RETURN,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/sales-returns',
    sourceLabel: 'مردودات المبيعات',
  },
  PURCHASE_RETURN: {
    slug: 'purchase-return',
    documentType: 'PURCHASE_RETURN',
    title: DOCUMENT_TYPE_TITLE.PURCHASE_RETURN,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/purchase-returns',
    sourceLabel: 'مردودات المشتريات',
  },
  STOCK_ISSUE: {
    slug: 'stock-issue',
    documentType: 'STOCK_ISSUE',
    title: DOCUMENT_TYPE_TITLE.STOCK_ISSUE,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/issue',
    sourceLabel: 'سند صرف مخزنية',
  },
  STOCK_RECEIPT: {
    slug: 'stock-receipt',
    documentType: 'STOCK_RECEIPT',
    title: DOCUMENT_TYPE_TITLE.STOCK_RECEIPT,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/receipt',
    sourceLabel: 'سند إضافة مخزنية',
  },
  PAYMENT_VOUCHER: {
    slug: 'payment-voucher',
    documentType: 'PAYMENT_VOUCHER',
    title: DOCUMENT_TYPE_TITLE.PAYMENT_VOUCHER,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/operations/treasury/payment-voucher',
    sourceLabel: 'سند الصرف',
  },
  RECEIPT_VOUCHER: {
    slug: 'receipt-voucher',
    documentType: 'RECEIPT_VOUCHER',
    title: DOCUMENT_TYPE_TITLE.RECEIPT_VOUCHER,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/operations/treasury/receipt-voucher',
    sourceLabel: 'سند القبض',
  },
  BANK_DEBIT_ADVICE: {
    slug: 'bank-discount',
    documentType: 'BANK_DEBIT_ADVICE',
    title: DOCUMENT_TYPE_TITLE.BANK_DEBIT_ADVICE,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/operations/banks/bank-discount',
    sourceLabel: 'إشعار الخصم',
  },
  BANK_CREDIT_ADVICE: {
    slug: 'bank-addition',
    documentType: 'BANK_CREDIT_ADVICE',
    title: DOCUMENT_TYPE_TITLE.BANK_CREDIT_ADVICE,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/operations/banks/bank-addition',
    sourceLabel: 'إشعار الإضافة',
  },
  JOURNAL_ENTRY: {
    slug: 'journal-entry',
    documentType: 'JOURNAL_ENTRY',
    title: DOCUMENT_TYPE_TITLE.JOURNAL_ENTRY,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/operations/journal-entry',
    sourceLabel: 'سند قيد يومية',
  },
  OPENING_BALANCE: {
    slug: 'opening-balance',
    documentType: 'OPENING_BALANCE',
    title: DOCUMENT_TYPE_TITLE.OPENING_BALANCE,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/operations/basic-operations/opening-balance',
    sourceLabel: 'الرصيد الإفتتاحي',
  },
};

export const TREASURY_DOCUMENT_TYPES: TransactionDocumentType[] = [
  'PAYMENT_VOUCHER',
  'RECEIPT_VOUCHER',
  'BANK_DEBIT_ADVICE',
  'BANK_CREDIT_ADVICE',
];

export function isTreasuryDocumentType(type: TransactionDocumentType): boolean {
  return TREASURY_DOCUMENT_TYPES.includes(type);
}

export function isJournalLikeDocumentType(type: TransactionDocumentType): boolean {
  return type === 'JOURNAL_ENTRY' || type === 'OPENING_BALANCE';
}

export function settingsPageHref(documentType: TransactionDocumentType): string {
  const ctx = TRANSACTION_SETTINGS_CONTEXT[documentType];
  return `/${ctx.module}/settings/transactions/${ctx.slug}`;
}

export function contextFromSettingsSlug(slug?: string | null): TransactionSettingsContext | null {
  const documentType = DOCUMENT_TYPE_SLUG[String(slug ?? '')];
  return documentType ? TRANSACTION_SETTINGS_CONTEXT[documentType] : null;
}

export function settingsHrefForNav(href?: string): string | null {
  if (!href) return null;
  if (href.includes('/settings/transactions/')) return null;
  if (href.includes('/sales-invoice')) return settingsPageHref('SALES_INVOICE');
  if (href.includes('/sales-returns')) return settingsPageHref('SALES_RETURN');
  if (href.includes('/purchase-returns')) return settingsPageHref('PURCHASE_RETURN');
  if (href.includes('/final-purchase-invoice')) return settingsPageHref('PURCHASE_INVOICE');
  if (href.includes('/payment-voucher') || href.includes('/cash-payment')) {
    return settingsPageHref('PAYMENT_VOUCHER');
  }
  if (href.includes('/receipt-voucher') || href.includes('/cash-receipt')) {
    return settingsPageHref('RECEIPT_VOUCHER');
  }
  if (href.includes('/bank-discount')) return settingsPageHref('BANK_DEBIT_ADVICE');
  if (href.includes('/bank-addition')) return settingsPageHref('BANK_CREDIT_ADVICE');
  if (href.includes('/journal-entry')) return settingsPageHref('JOURNAL_ENTRY');
  if (href.includes('/opening-balance')) return settingsPageHref('OPENING_BALANCE');
  if (href.includes('/payment-order')) return settingsPageHref('PAYMENT_VOUCHER');
  if (href.includes('/receipt-order')) return settingsPageHref('RECEIPT_VOUCHER');
  if (href.includes('/operations/issue')) return settingsPageHref('STOCK_ISSUE');
  if (href.includes('/operations/receipt') && href.includes('/inventory')) {
    return settingsPageHref('STOCK_RECEIPT');
  }
  return null;
}

/** When viewing a document's settings, keep its source screen highlighted in the module menu. */
export function sourceHrefForSettingsPath(pathname?: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(/\/settings\/transactions\/([^/?#]+)/);
  if (!match) return null;
  return contextFromSettingsSlug(match[1])?.sourceHref ?? null;
}
