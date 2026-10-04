/** Arabic labels for report `summary` object keys from the backend. */

const SUMMARY_KEY_LABELS: Record<string, string> = {
  totalInvoices: 'عدد الفواتير',
  salesInvoiceCount: 'عدد فواتير المبيعات',
  returnInvoiceCount: 'عدد فواتير المرتجعات',
  salesValue: 'قيمة المبيعات',
  returnValue: 'قيمة المرتجعات',
  netValue: 'صافي القيمة',
  totalSales: 'إجمالي المبيعات',
  additionsAmount: 'إجمالي الإضافات',
  discountsAmount: 'إجمالي الخصومات',
  netAdditionsAndDiscounts: 'صافي الإضافات والخصومات',
  otherDiscountsAmount: 'إجمالي الخصومات الأخرى',
  discountAmount: 'إجمالي الخصم',
  withholdingTaxAmount: 'إجمالي خصم المنبع',
  taxAmount: 'إجمالي ضريبة المبيعات',
  netAmount: 'إجمالي الصافي',
  paidAmount: 'إجمالي المسدد',
  remainingAmount: 'إجمالي المتبقي',
  totalPurchases: 'إجمالي المشتريات',
  totalQuantity: 'إجمالي الكمية',
  totalReturns: 'إجمالي المرتجعات',
  totalPaid: 'إجمالي المدفوع',
  totalPayments: 'إجمالي الدفعات',
  totalReceipts: 'إجمالي المقبوضات',
  netBalance: 'الرصيد',
  totalSettled: 'إجمالي المسدد',
  totalOverdue: 'إجمالي المتأخر',
  totalRemaining: 'المتبقي',
  totalProfit: 'إجمالي الربح',
  totalCost: 'إجمالي التكلفة',
  netSales: 'صافي المبيعات',
  balance: 'الرصيد',
  totalAmount: 'الإجمالي',
  totalPapers: 'عدد الأوراق',
  receiptAmount: 'مجموع أوراق القبض',
  paymentAmount: 'مجموع أوراق الدفع',
  receipts: 'عدد أوراق القبض',
  payments: 'عدد أوراق الدفع',
  renewals: 'التجديدات',
  totalDiscount: 'إجمالي الخصم',
  totalTax: 'إجمالي الضريبة',
  totalSalesTax: 'ضريبة المبيعات',
  totalPurchaseTax: 'ضريبة المشتريات',
  averageProfitPercent: 'متوسط نسبة الربح',
  totalDebit: 'إجمالي المبالغ المدينة',
  totalCredit: 'إجمالي المبالغ الدائنة',
  uncollectedAmount: 'الأوراق المالية غير المحصلة',
  creditLimitAmount: 'الحد الائتماني',
  availableCreditAmount: 'الرصيد المتاح للحد الائتماني',
  totalCustomers: 'عدد العملاء',
  totalSuppliers: 'عدد الموردين',
  totalItems: 'عدد الأصناف',
  saleValue: 'قيمة البيع',
  costValue: 'قيمة التكلفة',
  totalReceivables: 'إجمالي المديونيات',
  totalCollections: 'إجمالي التحصيلات',
  totalCurrent: 'إجمالي المستحق',
  totalBalances: 'إجمالي الأرصدة',
  totalPreviousBalance: 'إجمالي الرصيد السابق',
  totalCurrentBalance: 'إجمالي الرصيد الحالي',
  totalBudget: 'إجمالي الموازنة',
  totalBudgetRemaining: 'المتبقي للموازنة',
  totalPayables: 'إجمالي الدائنيات',
  count: 'العدد',
  page: 'الصفحة',
  limit: 'حد الصفحة',
  total: 'الإجمالي',
  totalPages: 'عدد الصفحات',
  totalRevenue: 'إجمالي الإيرادات',
  totalExpenses: 'إجمالي المصروفات',
  costOfGoodsSold: 'تكلفة المبيعات',
  grossProfit: 'مجمل الربح',
  operatingProfit: 'الربح التشغيلي',
  netProfit: 'صافي الربح',
  totalAssets: 'إجمالي الأصول',
  totalLiabilities: 'إجمالي الخصوم',
  totalEquity: 'إجمالي حقوق الملكية',
  equationBalanced: 'الميزانية متوازنة',
  netIncome: 'صافي الربح',
  operatingCashFlow: 'التدفق النقدي التشغيلي',
  investingCashFlow: 'التدفق النقدي الاستثماري',
  financingCashFlow: 'التدفق النقدي التمويلي',
  netChangeInCash: 'صافي التغير في النقدية',
  cashAtBeginning: 'النقدية في بداية الفترة',
  cashAtEnd: 'النقدية في نهاية الفترة',
  reconciled: 'مطابق لحسابات النقدية بدفتر الأستاذ',
  totalInQty: 'إجمالي الكميات الداخلة',
  totalInAmount: 'إجمالي الأسعار الداخلة',
  totalOutQty: 'إجمالي الكميات الخارجة',
  totalOutAmount: 'إجمالي الأسعار الخارجة',
  qtyDifference: 'فرق الكميات',
  lotCount: 'عدد التشغيلات',
  onHandLots: 'تشغيلات لها رصيد',
  expiredLots: 'تشغيلات منتهية',
  soonLots: 'تنتهي خلال 30 يوم',
  quarterLots: 'تنتهي خلال 90 يوم',
  consumedLots: 'تشغيلات صُرفت',
  itemCount: 'عدد الأصناف',
  openingBalance: 'رصيد أول المدة',
  previousBalance: 'الرصيد السابق',
  closingBalance: 'رصيد آخر المدة',
  currencyName: 'العملة',
  counterpartAccountName: 'الحساب المقابل',
  costCenterName: 'مركز التكلفة',
  supportedDebit: 'مؤيد مدين',
  supportedCredit: 'مؤيد دائن',
  unsupportedDebit: 'غير مؤيد مدين',
  unsupportedCredit: 'غير مؤيد دائن',
  unsupportedPercent: 'نسبة غير المؤيد',
};

const MONEY_KEY_HINTS =
  /sales|purchase|amount|profit|cost|paid|balance|tax|receivable|payable|discount|total|cash|income|debit|credit|value|budget/i;
const COUNT_KEY_HINTS = /count|invoices|quantity|items|customers|suppliers|pages/i;

export function summaryFieldLabel(key: string): string {
  if (SUMMARY_KEY_LABELS[key]) return SUMMARY_KEY_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim();
}

export function formatSummaryValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (MONEY_KEY_HINTS.test(key) && !COUNT_KEY_HINTS.test(key)) {
      return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value.toLocaleString('ar-EG');
  }
  if (typeof value === 'string') {
    const n = Number(value);
    if (value.trim() !== '' && Number.isFinite(n)) {
      return formatSummaryValue(key, n);
    }
    return value;
  }
  if (typeof value === 'object') return '—';
  return String(value);
}

function currencyStatementLabel(key: string, record: Record<string, unknown>): string | null {
  const base = typeof record.baseCurrencyName === 'string' ? record.baseCurrencyName.trim() : '';
  const foreign = typeof record.foreignCurrencyName === 'string' ? record.foreignCurrencyName.trim() : '';
  if (base || foreign) {
    if (key === 'baseDebit') return `إجمالي المبالغ المدينة ${base}`.trim();
    if (key === 'baseCredit') return `إجمالي المبالغ الدائنة ${base}`.trim();
    if (key === 'baseBalance') return `الرصيد ${base}`.trim();
    if (key === 'foreignDebit') return `إجمالي المبالغ المدينة ${foreign}`.trim();
    if (key === 'foreignCredit') return `إجمالي المبالغ الدائنة ${foreign}`.trim();
    if (key === 'foreignBalance') return `الرصيد ${foreign}`.trim();
  }
  const match = /^(debit|credit|balance)_(.+)$/.exec(key);
  if (!match) return null;
  const currencies = Array.isArray(record.currencies) ? record.currencies : [];
  const code = match[2];
  const found = currencies.find(
    (item) =>
      item &&
      typeof item === 'object' &&
      String((item as { code?: unknown }).code || '').toUpperCase() === code.toUpperCase()
  ) as { name?: unknown; code?: unknown } | undefined;
  const name = String(found?.name || found?.code || code).trim();
  if (match[1] === 'debit') return `إجمالي المبالغ المدينة ${name}`.trim();
  if (match[1] === 'credit') return `إجمالي المبالغ الدائنة ${name}`.trim();
  return `الرصيد ${name}`.trim();
}

function currencySummaryEntries(record: Record<string, unknown>) {
  const currencies = Array.isArray(record.currencies) ? record.currencies : [];
  const entries: Array<{ key: string; label: string; value: string }> = [];
  for (const raw of currencies) {
    if (!raw || typeof raw !== 'object') continue;
    const currency = raw as { code?: unknown; name?: unknown; debit?: unknown; credit?: unknown; balance?: unknown };
    const code = String(currency.code || '').trim().toUpperCase();
    const name = String(currency.name || code).trim();
    if (!code) continue;
    entries.push({
      key: `debit_${code}`,
      label: `إجمالي المبالغ المدينة ${name}`.trim(),
      value: formatSummaryValue('debit', currency.debit ?? 0),
    });
    entries.push({
      key: `credit_${code}`,
      label: `إجمالي المبالغ الدائنة ${name}`.trim(),
      value: formatSummaryValue('credit', currency.credit ?? 0),
    });
    entries.push({
      key: `balance_${code}`,
      label: `الرصيد ${name}`.trim(),
      value: formatSummaryValue('balance', currency.balance ?? 0),
    });
  }
  return entries;
}

export function flattenSummaryEntries(summary: unknown): Array<{ key: string; label: string; value: string }> {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return [];
  const record = summary as Record<string, unknown>;
  const fromCurrencies = currencySummaryEntries(record);
  const rest = Object.entries(record)
    .filter(
      ([key, v]) =>
        key !== 'baseCurrencyName' &&
        key !== 'foreignCurrencyName' &&
        key !== 'currencies' &&
        v !== null &&
        v !== undefined &&
        typeof v !== 'object'
    )
    .map(([key, value]) => ({
      key,
      label: currencyStatementLabel(key, record) || summaryFieldLabel(key),
      value: formatSummaryValue(key, value),
    }));
  return fromCurrencies.length ? [...fromCurrencies, ...rest] : rest;
}
