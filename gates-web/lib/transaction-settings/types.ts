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
  | 'OPENING_BALANCE'
  | 'SECURITIES_RECEIPT'
  | 'SECURITIES_PAYMENT'
  | 'STOCK_TRANSFER'
  | 'STOCK_STOCKTAKING'
  | 'PURCHASE_ORDER'
  | 'STOCK_OTHER_ADJUSTMENT'
  | 'OPENING_STOCK'
  | 'STOCK_ASSEMBLY'
  | 'STOCK_DISASSEMBLY'
  | 'PRICE_QUOTE'
  | 'SALES_ORDER'
  | 'MANUFACTURING_ORDER'
  | 'MANUFACTURING_WORK_ORDER'
  | 'PAYMENT_ORDER'
  | 'RECEIPT_ORDER'
  | 'TEMPORARY_RECEIPT'
  | 'CHEQUE_RECEIPT'
  | 'CHEQUE_PAYMENT'
  | 'OPENING_SECURITIES_RECEIPT'
  | 'OPENING_SECURITIES_PAYMENT';

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
  /** خزنة أمر الصرف / أمر التوريد الافتراضية (Safe id، مش حساب GL). */
  defaultSafeId?: string | null;
  /** حساب بنكي لإشعار الخصم/الإضافة (BankAccount id، مش حساب GL). */
  defaultBankAccountId?: string | null;
  pricingPolicy: PricingPolicy;
  costCenterSide: CostCenterPostingSide;
  costCenterAllocationTarget: CostCenterAllocationTarget;
  allowStandaloneReturns: boolean;
  enforceOriginalPrice: boolean;
  showFxColumns: boolean;
  allowEditLoadedOrder: boolean;
  /** أيام قبل موعد الدفعة لإرسال تنبيه (0 أو null = بدون تنبيه). */
  installmentReminderDaysBefore?: number | null;
  /** تجميع أصناف: تنبيه لفتح فاتورة مبيعات بعد الحفظ. */
  warnSalesInvoiceOnAssemblySave?: boolean;
  archiveRequireOnSave?: boolean;
  archiveMandatoryMode?: 'ANY' | 'ALL_CATEGORIES' | 'SELECTED_CATEGORIES';
  archiveMandatoryCategories?: string[] | null;
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
  'securities-receipt': 'SECURITIES_RECEIPT',
  'securities-payment': 'SECURITIES_PAYMENT',
  'stock-transfer': 'STOCK_TRANSFER',
  'stock-stocktaking': 'STOCK_STOCKTAKING',
  'purchase-order': 'PURCHASE_ORDER',
  'stock-other-adjustment': 'STOCK_OTHER_ADJUSTMENT',
  'opening-stock': 'OPENING_STOCK',
  'stock-assembly': 'STOCK_ASSEMBLY',
  'stock-disassembly': 'STOCK_DISASSEMBLY',
  'price-quote': 'PRICE_QUOTE',
  'sales-order': 'SALES_ORDER',
  'manufacturing-order': 'MANUFACTURING_ORDER',
  'manufacturing-work-order': 'MANUFACTURING_WORK_ORDER',
  'payment-order': 'PAYMENT_ORDER',
  'receipt-order': 'RECEIPT_ORDER',
  'temporary-receipt': 'TEMPORARY_RECEIPT',
  'cheque-receipt': 'CHEQUE_RECEIPT',
  'cheque-payment': 'CHEQUE_PAYMENT',
  'opening-securities-receipt': 'OPENING_SECURITIES_RECEIPT',
  'opening-securities-payment': 'OPENING_SECURITIES_PAYMENT',
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
  SECURITIES_RECEIPT: 'إعدادات ورقة المقبوضات',
  SECURITIES_PAYMENT: 'إعدادات ورقة المدفوعات',
  STOCK_TRANSFER: 'إعدادات تحويل مخزني',
  STOCK_STOCKTAKING: 'إعدادات الجرد',
  PURCHASE_ORDER: 'إعدادات أمر الشراء',
  STOCK_OTHER_ADJUSTMENT: 'إعدادات تسوية أخرى',
  OPENING_STOCK: 'إعدادات بضاعة أول المدة',
  STOCK_ASSEMBLY: 'إعدادات تجميع أصناف',
  STOCK_DISASSEMBLY: 'إعدادات تفكيك أصناف',
  PRICE_QUOTE: 'إعدادات عرض السعر',
  SALES_ORDER: 'إعدادات أمر البيع',
  MANUFACTURING_ORDER: 'إعدادات عملية التصنيع',
  MANUFACTURING_WORK_ORDER: 'إعدادات أمر الشغل',
  PAYMENT_ORDER: 'إعدادات أمر صرف نقدية',
  RECEIPT_ORDER: 'إعدادات أمر توريد نقدية',
  TEMPORARY_RECEIPT: 'إعدادات إيصال استلام مؤقت',
  CHEQUE_RECEIPT: 'إعدادات شيكات القبض',
  CHEQUE_PAYMENT: 'إعدادات شيكات الدفع',
  OPENING_SECURITIES_RECEIPT: 'إعدادات أوراق مالية سابقة (قبض)',
  OPENING_SECURITIES_PAYMENT: 'إعدادات أوراق مالية سابقة (دفع)',
};

export type TransactionSettingsModule = 'inventory' | 'accounting' | 'manufacturing';

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
    sourceLabel: 'إذن صرف مخزني',
  },
  STOCK_RECEIPT: {
    slug: 'stock-receipt',
    documentType: 'STOCK_RECEIPT',
    title: DOCUMENT_TYPE_TITLE.STOCK_RECEIPT,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/receipt',
    sourceLabel: 'إذن إضافة مخزني',
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
  SECURITIES_RECEIPT: {
    slug: 'securities-receipt',
    documentType: 'SECURITIES_RECEIPT',
    title: DOCUMENT_TYPE_TITLE.SECURITIES_RECEIPT,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/operations/securities/receipt',
    sourceLabel: 'ورقة مقبوضات',
  },
  SECURITIES_PAYMENT: {
    slug: 'securities-payment',
    documentType: 'SECURITIES_PAYMENT',
    title: DOCUMENT_TYPE_TITLE.SECURITIES_PAYMENT,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/operations/securities/payment',
    sourceLabel: 'ورقة مدفوعات',
  },
  PAYMENT_ORDER: {
    slug: 'payment-order',
    documentType: 'PAYMENT_ORDER',
    title: DOCUMENT_TYPE_TITLE.PAYMENT_ORDER,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/orders/payment-order/new',
    sourceLabel: 'أمر صرف نقدية',
  },
  RECEIPT_ORDER: {
    slug: 'receipt-order',
    documentType: 'RECEIPT_ORDER',
    title: DOCUMENT_TYPE_TITLE.RECEIPT_ORDER,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/orders/receipt-order/new',
    sourceLabel: 'أمر توريد نقدية',
  },
  TEMPORARY_RECEIPT: {
    slug: 'temporary-receipt',
    documentType: 'TEMPORARY_RECEIPT',
    title: DOCUMENT_TYPE_TITLE.TEMPORARY_RECEIPT,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/operations/treasury/temp-receipt',
    sourceLabel: 'إيصال استلام مؤقت',
  },
  CHEQUE_RECEIPT: {
    slug: 'cheque-receipt',
    documentType: 'CHEQUE_RECEIPT',
    title: DOCUMENT_TYPE_TITLE.CHEQUE_RECEIPT,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/cheques/incoming',
    sourceLabel: 'شيكات القبض',
  },
  CHEQUE_PAYMENT: {
    slug: 'cheque-payment',
    documentType: 'CHEQUE_PAYMENT',
    title: DOCUMENT_TYPE_TITLE.CHEQUE_PAYMENT,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/cheques/outgoing',
    sourceLabel: 'شيكات الدفع',
  },
  OPENING_SECURITIES_RECEIPT: {
    slug: 'opening-securities-receipt',
    documentType: 'OPENING_SECURITIES_RECEIPT',
    title: DOCUMENT_TYPE_TITLE.OPENING_SECURITIES_RECEIPT,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/operations/basic-operations/opening-securities',
    sourceLabel: 'أوراق مالية سابقة',
  },
  OPENING_SECURITIES_PAYMENT: {
    slug: 'opening-securities-payment',
    documentType: 'OPENING_SECURITIES_PAYMENT',
    title: DOCUMENT_TYPE_TITLE.OPENING_SECURITIES_PAYMENT,
    module: 'accounting',
    moduleLabel: 'الحسابات العامة',
    sourceHref: '/accounting/operations/basic-operations/opening-securities',
    sourceLabel: 'أوراق مالية سابقة',
  },
  STOCK_TRANSFER: {
    slug: 'stock-transfer',
    documentType: 'STOCK_TRANSFER',
    title: DOCUMENT_TYPE_TITLE.STOCK_TRANSFER,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/transfer',
    sourceLabel: 'تحويل مخزني',
  },
  STOCK_STOCKTAKING: {
    slug: 'stock-stocktaking',
    documentType: 'STOCK_STOCKTAKING',
    title: DOCUMENT_TYPE_TITLE.STOCK_STOCKTAKING,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/stocktaking',
    sourceLabel: 'الجرد',
  },
  PURCHASE_ORDER: {
    slug: 'purchase-order',
    documentType: 'PURCHASE_ORDER',
    title: DOCUMENT_TYPE_TITLE.PURCHASE_ORDER,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/purchase-order',
    sourceLabel: 'أمر الشراء',
  },
  STOCK_OTHER_ADJUSTMENT: {
    slug: 'stock-other-adjustment',
    documentType: 'STOCK_OTHER_ADJUSTMENT',
    title: DOCUMENT_TYPE_TITLE.STOCK_OTHER_ADJUSTMENT,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/other-adjustment',
    sourceLabel: 'تسوية أخرى',
  },
  OPENING_STOCK: {
    slug: 'opening-stock',
    documentType: 'OPENING_STOCK',
    title: DOCUMENT_TYPE_TITLE.OPENING_STOCK,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/opening-stock',
    sourceLabel: 'بضاعة أول المدة',
  },
  STOCK_ASSEMBLY: {
    slug: 'stock-assembly',
    documentType: 'STOCK_ASSEMBLY',
    title: DOCUMENT_TYPE_TITLE.STOCK_ASSEMBLY,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/assembly',
    sourceLabel: 'تجميع أصناف',
  },
  STOCK_DISASSEMBLY: {
    slug: 'stock-disassembly',
    documentType: 'STOCK_DISASSEMBLY',
    title: DOCUMENT_TYPE_TITLE.STOCK_DISASSEMBLY,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/disassembly',
    sourceLabel: 'تفكيك أصناف',
  },
  PRICE_QUOTE: {
    slug: 'price-quote',
    documentType: 'PRICE_QUOTE',
    title: DOCUMENT_TYPE_TITLE.PRICE_QUOTE,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/price-quote',
    sourceLabel: 'عرض سعر',
  },
  SALES_ORDER: {
    slug: 'sales-order',
    documentType: 'SALES_ORDER',
    title: DOCUMENT_TYPE_TITLE.SALES_ORDER,
    module: 'inventory',
    moduleLabel: 'المخازن',
    sourceHref: '/inventory/operations/sales-order',
    sourceLabel: 'أمر البيع',
  },
  MANUFACTURING_ORDER: {
    slug: 'manufacturing-order',
    documentType: 'MANUFACTURING_ORDER',
    title: DOCUMENT_TYPE_TITLE.MANUFACTURING_ORDER,
    module: 'manufacturing',
    moduleLabel: 'التصنيع والإنتاج',
    sourceHref: '/manufacturing/operations/operation',
    sourceLabel: 'عملية التصنيع',
  },
  MANUFACTURING_WORK_ORDER: {
    slug: 'manufacturing-work-order',
    documentType: 'MANUFACTURING_WORK_ORDER',
    title: DOCUMENT_TYPE_TITLE.MANUFACTURING_WORK_ORDER,
    module: 'manufacturing',
    moduleLabel: 'التصنيع والإنتاج',
    sourceHref: '/manufacturing/operations/production-planning',
    sourceLabel: 'أمر الشغل',
  },
};

export const TREASURY_DOCUMENT_TYPES: TransactionDocumentType[] = [
  'PAYMENT_VOUCHER',
  'RECEIPT_VOUCHER',
  'BANK_DEBIT_ADVICE',
  'BANK_CREDIT_ADVICE',
  'PAYMENT_ORDER',
  'RECEIPT_ORDER',
  'TEMPORARY_RECEIPT',
];

export function isTreasuryDocumentType(type: TransactionDocumentType): boolean {
  return TREASURY_DOCUMENT_TYPES.includes(type);
}

export function isTreasuryOrderDocumentType(type: TransactionDocumentType): boolean {
  return type === 'PAYMENT_ORDER' || type === 'RECEIPT_ORDER';
}

/** أوامر الخزينة + إيصال مؤقت: بدون قيد من الشاشة، والخزنة الافتراضية خزنة مش حساب. */
export function isNonJournalTreasuryDocumentType(type: TransactionDocumentType): boolean {
  return isTreasuryOrderDocumentType(type) || type === 'TEMPORARY_RECEIPT';
}

export function usesDefaultTreasurySafe(type: TransactionDocumentType): boolean {
  return (
    isNonJournalTreasuryDocumentType(type) ||
    type === 'PAYMENT_VOUCHER' ||
    type === 'RECEIPT_VOUCHER'
  );
}

export function usesDefaultBankAccount(type: TransactionDocumentType): boolean {
  return type === 'BANK_DEBIT_ADVICE' || type === 'BANK_CREDIT_ADVICE';
}

export function isJournalLikeDocumentType(type: TransactionDocumentType): boolean {
  return type === 'JOURNAL_ENTRY' || type === 'OPENING_BALANCE';
}

/** قيد اليومية always allocates its GL serial; the settings screen must not offer يدوي. */
export function documentForcesAutomaticNumbering(type: TransactionDocumentType): boolean {
  return type === 'JOURNAL_ENTRY';
}

const STORE_WAREHOUSE_DOCUMENT_TYPES: TransactionDocumentType[] = [
  'STOCK_RECEIPT',
  'STOCK_ISSUE',
  'STOCK_TRANSFER',
  'STOCK_STOCKTAKING',
  'STOCK_OTHER_ADJUSTMENT',
  'OPENING_STOCK',
  'STOCK_ASSEMBLY',
  'STOCK_DISASSEMBLY',
];

export function isStoreWarehouseDocumentType(type: TransactionDocumentType): boolean {
  return STORE_WAREHOUSE_DOCUMENT_TYPES.includes(type);
}

/** مخزن/فواتير تؤثر على الرصيد والجرد المستمر — إيقاف القيد يحتاج تأكيد. */
const PERPETUAL_INVENTORY_JOURNAL_DOCUMENT_TYPES: TransactionDocumentType[] = [
  'STOCK_RECEIPT',
  'STOCK_ISSUE',
  'PURCHASE_INVOICE',
  'SALES_INVOICE',
  'PURCHASE_RETURN',
  'SALES_RETURN',
  'STOCK_TRANSFER',
  'STOCK_STOCKTAKING',
  'STOCK_ASSEMBLY',
  'STOCK_DISASSEMBLY',
];

export function warnsWhenDisablingJournalGeneration(type: TransactionDocumentType): boolean {
  return PERPETUAL_INVENTORY_JOURNAL_DOCUMENT_TYPES.includes(type);
}

export function isManufacturingDocumentType(type: TransactionDocumentType): boolean {
  return type === 'MANUFACTURING_ORDER' || type === 'MANUFACTURING_WORK_ORDER';
}

export function isCommercialDocumentType(type: TransactionDocumentType): boolean {
  return (
    type === 'PRICE_QUOTE' ||
    type === 'SALES_ORDER' ||
    type === 'PURCHASE_ORDER' ||
    type === 'SALES_INVOICE' ||
    type === 'PURCHASE_INVOICE' ||
    type === 'SALES_RETURN' ||
    type === 'PURCHASE_RETURN'
  );
}

export function supportsInstallmentDueReminders(type: TransactionDocumentType): boolean {
  return (
    type === 'SALES_INVOICE' ||
    type === 'PURCHASE_INVOICE' ||
    type === 'SECURITIES_RECEIPT' ||
    type === 'SECURITIES_PAYMENT'
  );
}

export function isSecuritiesPaperDueReminderDocumentType(type: TransactionDocumentType): boolean {
  return type === 'SECURITIES_RECEIPT' || type === 'SECURITIES_PAYMENT';
}

export function supportsAssemblySalesInvoiceWarning(type: TransactionDocumentType): boolean {
  return type === 'STOCK_ASSEMBLY';
}

/** عرض سعر / أمر بيع / أمر شراء (أمر توريد) — بدون قيد وبدون تأثير مخزني. */
export function isNonPostingOrderDocumentType(type: TransactionDocumentType): boolean {
  return type === 'PRICE_QUOTE' || type === 'SALES_ORDER' || type === 'PURCHASE_ORDER';
}

/** أمر شراء / فاتورة مشتريات — مش بيع، ومش بتنقص رصيد عند الحفظ. */
export function hidesPurchaseCostAndNegativeStockGuards(type: TransactionDocumentType): boolean {
  return type === 'PURCHASE_ORDER' || type === 'PURCHASE_INVOICE';
}

export function isSecuritiesDocumentType(type: TransactionDocumentType): boolean {
  return (
    type === 'SECURITIES_RECEIPT' ||
    type === 'SECURITIES_PAYMENT' ||
    type === 'CHEQUE_RECEIPT' ||
    type === 'CHEQUE_PAYMENT' ||
    type === 'OPENING_SECURITIES_RECEIPT' ||
    type === 'OPENING_SECURITIES_PAYMENT'
  );
}

export function canLoadSourceOrder(type: TransactionDocumentType): boolean {
  return (
    isTreasuryOrderDocumentType(type) ||
    type === 'SALES_INVOICE' ||
    type === 'PURCHASE_INVOICE' ||
    type === 'SALES_RETURN' ||
    type === 'PURCHASE_RETURN' ||
    type === 'SALES_ORDER' ||
    type === 'PURCHASE_ORDER'
  );
}

export function shouldLockLoadedSource(
  settings: { allowEditLoadedOrder?: boolean } | undefined,
  sourceId?: string | null
): boolean {
  return settings?.allowEditLoadedOrder === false && Boolean(sourceId);
}

export function shouldLockItemPriceOverride(
  settings: { allowItemPriceOverride?: boolean } | undefined
): boolean {
  return settings?.allowItemPriceOverride === false;
}

export function shouldShowAllAccountsInPartyField(
  settings: { showAllAccountsInCustomerField?: boolean } | undefined
): boolean {
  return settings?.showAllAccountsInCustomerField === true;
}

export function settingsPageHref(documentType: TransactionDocumentType): string {
  const ctx = TRANSACTION_SETTINGS_CONTEXT[documentType];
  return `/${ctx.module}/settings/transactions/${ctx.slug}`;
}

/** Warehouse sidebar / hub: one settings page per operations screen. */
export const INVENTORY_DOCUMENT_SETTINGS_GROUPS: Array<{
  title: string;
  types: TransactionDocumentType[];
}> = [
  {
    title: 'المخازن',
    types: [
      'STOCK_RECEIPT',
      'STOCK_ISSUE',
      'STOCK_TRANSFER',
      'STOCK_ASSEMBLY',
      'STOCK_DISASSEMBLY',
      'STOCK_STOCKTAKING',
      'OPENING_STOCK',
      'STOCK_OTHER_ADJUSTMENT',
    ],
  },
  {
    title: 'المبيعات',
    types: ['PRICE_QUOTE', 'SALES_ORDER', 'SALES_INVOICE', 'SALES_RETURN'],
  },
  {
    title: 'المشتريات',
    types: ['PURCHASE_ORDER', 'PURCHASE_INVOICE', 'PURCHASE_RETURN'],
  },
];

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
  if (href.includes('/payment-order')) return settingsPageHref('PAYMENT_ORDER');
  if (href.includes('/receipt-order')) return settingsPageHref('RECEIPT_ORDER');
  if (href.includes('/temp-receipt')) return settingsPageHref('TEMPORARY_RECEIPT');
  if (href.includes('/cheques/incoming')) return settingsPageHref('CHEQUE_RECEIPT');
  if (href.includes('/cheques/outgoing')) return settingsPageHref('CHEQUE_PAYMENT');
  if (href.includes('/opening-securities')) return settingsPageHref('OPENING_SECURITIES_RECEIPT');
  if (href.includes('/payment-voucher') || href.includes('/treasury/payment')) {
    return settingsPageHref('PAYMENT_VOUCHER');
  }
  if (
    href.includes('/receipt-voucher') ||
    (href.includes('/treasury/receipt') && !href.includes('temp-receipt'))
  ) {
    return settingsPageHref('RECEIPT_VOUCHER');
  }
  if (href.includes('/bank-discount')) return settingsPageHref('BANK_DEBIT_ADVICE');
  if (href.includes('/bank-addition')) return settingsPageHref('BANK_CREDIT_ADVICE');
  if (href.includes('/journal-entry')) return settingsPageHref('JOURNAL_ENTRY');
  if (href.includes('/opening-balance')) return settingsPageHref('OPENING_BALANCE');
  if (href.includes('/securities/receipt')) return settingsPageHref('SECURITIES_RECEIPT');
  if (href.includes('/securities/payment')) return settingsPageHref('SECURITIES_PAYMENT');
  if (href.includes('/operations/issue')) return settingsPageHref('STOCK_ISSUE');
  if (href.includes('/operations/receipt') && href.includes('/inventory')) {
    return settingsPageHref('STOCK_RECEIPT');
  }
  if (href.includes('/operations/transfer')) return settingsPageHref('STOCK_TRANSFER');
  if (href.includes('/operations/stocktaking')) return settingsPageHref('STOCK_STOCKTAKING');
  if (href.includes('/operations/purchase-order')) return settingsPageHref('PURCHASE_ORDER');
  if (href.includes('/operations/other-adjustment')) return settingsPageHref('STOCK_OTHER_ADJUSTMENT');
  if (href.includes('/operations/opening-stock')) return settingsPageHref('OPENING_STOCK');
  if (href.includes('/operations/assembly')) return settingsPageHref('STOCK_ASSEMBLY');
  if (href.includes('/operations/disassembly')) return settingsPageHref('STOCK_DISASSEMBLY');
  if (href.includes('/operations/price-quote')) return settingsPageHref('PRICE_QUOTE');
  if (href.includes('/operations/sales-order')) return settingsPageHref('SALES_ORDER');
  if (href.includes('/manufacturing/operations/operation')) return settingsPageHref('MANUFACTURING_ORDER');
  if (href.includes('/manufacturing/operations/production-planning')) {
    return settingsPageHref('MANUFACTURING_WORK_ORDER');
  }
  return null;
}

/** Opens document settings in-place on the operation screen (drawer), not the standalone settings route. */
export function documentSettingsOpenHref(sourceHref?: string): string | null {
  if (!sourceHref || !settingsHrefForNav(sourceHref)) return null;
  const sep = sourceHref.includes('?') ? '&' : '?';
  return `${sourceHref}${sep}openDocumentSettings=1`;
}

/** When viewing a document's settings, keep its source screen highlighted in the module menu. */
export function sourceHrefForSettingsPath(pathname?: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(/\/settings\/transactions\/([^/?#]+)/);
  if (!match) return null;
  return contextFromSettingsSlug(match[1])?.sourceHref ?? null;
}
