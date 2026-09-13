/** Arabic labels for report `summary` object keys from the backend. */

const SUMMARY_KEY_LABELS: Record<string, string> = {
  totalInvoices: 'عدد الفواتير',
  totalSales: 'إجمالي المبيعات',
  totalPurchases: 'إجمالي المشتريات',
  totalQuantity: 'إجمالي الكميات',
  totalReturns: 'إجمالي المرتجعات',
  totalPaid: 'إجمالي المدفوع',
  totalProfit: 'إجمالي الربح',
  totalCost: 'إجمالي التكلفة',
  netSales: 'صافي المبيعات',
  balance: 'الرصيد',
  totalAmount: 'الإجمالي',
  totalDiscount: 'إجمالي الخصم',
  totalTax: 'إجمالي الضريبة',
  totalSalesTax: 'ضريبة المبيعات',
  totalPurchaseTax: 'ضريبة المشتريات',
  averageProfitPercent: 'متوسط نسبة الربح',
  totalCustomers: 'عدد العملاء',
  totalSuppliers: 'عدد الموردين',
  totalItems: 'عدد الأصناف',
  totalReceivables: 'إجمالي المديونيات',
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
};

const MONEY_KEY_HINTS =
  /sales|purchase|amount|profit|cost|paid|balance|tax|receivable|payable|discount|total|cash|income/i;
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

export function flattenSummaryEntries(summary: unknown): Array<{ key: string; label: string; value: string }> {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return [];
  const record = summary as Record<string, unknown>;
  return Object.entries(record)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
    .map(([key, value]) => ({
      key,
      label: summaryFieldLabel(key),
      value: formatSummaryValue(key, value),
    }));
}
