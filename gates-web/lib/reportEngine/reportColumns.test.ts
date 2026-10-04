import { getDefaultVisibleColumnIds, getReportColumnsForPath, getRowCellValue, ledgerFooterFigures, partyCurrencyStatementColumns } from './reportColumns';
import { formatReportCell } from './reportFormatters';
import { accountTypeLabel, labelForAutoColumn } from './reportColumnLabels';
import { flattenSummaryEntries } from '../reportPreview/reportSummaryLabels';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(labelForAutoColumn('lineId') === 'رقم السطر', 'lineId ar');
assert(labelForAutoColumn('entryDate') === 'تاريخ القيد', 'entryDate ar');
assert(labelForAutoColumn('legacyGlNum') === 'رقم القيد', 'legacyGlNum ar');
assert(labelForAutoColumn('debitBase') === 'مدين (أساسي)', 'debitBase ar');
assert(labelForAutoColumn('creditBase') === 'دائن (أساسي)', 'creditBase ar');
assert(labelForAutoColumn('runningBalance') === 'الرصيد', 'runningBalance ar');

const ledgerCols = getReportColumnsForPath('accounting/account-reports/books/daftar-ostaz', [
  {
    lineId: 'uuid',
    entryDate: '2026-01-01',
    legacyGlNum: '0001',
    sourceType: 'JOURNAL',
    sourceNumber: '1',
    description: 'قيد',
    debitBase: 10,
    creditBase: 0,
    runningBalance: 10,
  },
]);

assert(
  !ledgerCols.some((c) => c.id === 'lineId'),
  'lineId is technical'
);
assert(
  ledgerCols.map((c) => c.label).includes('تاريخ القيد'),
  'entryDate labeled'
);
assert(
  ledgerCols.map((c) => c.label).includes('رقم القيد'),
  'legacyGlNum labeled'
);
const sourceCol = ledgerCols.find((c) => c.id === 'sourceType');
assert(
  sourceCol &&
    getRowCellValue(
      { sourceType: 'SALES_INVOICE' },
      sourceCol
    ) === 'فاتورة مبيعات',
  'sourceType shows Arabic name'
);
assert(ledgerCols.find((c) => c.id === 'debitBase')?.totalMode === 'withOpening', 'ledger debit total');
assert(ledgerCols.find((c) => c.id === 'creditBase')?.totalMode === 'withOpening', 'ledger credit total');
assert(ledgerCols.find((c) => c.id === 'runningBalance')?.totalMode === 'net', 'ledger balance is debit minus credit');
assert(
  sourceCol &&
    getRowCellValue(
      { sourceType: 'MANUAL', sourceKind: 'MANUAL', entryType: 'OPENING_BALANCE' },
      sourceCol
    ) === 'قيد افتتاحي',
  'opening journal shows قيد افتتاحي'
);
assert(
  sourceCol &&
    getRowCellValue(
      { sourceType: 'CP', sourceKind: 'PAYMENT_VOUCHER', voucherFund: 'bank' },
      sourceCol
    ) === 'إشعار خصم بنكي',
  'bank payment notice'
);
assert(
  sourceCol &&
    getRowCellValue(
      { sourceType: 'CR', sourceKind: 'RECEIPT_VOUCHER', voucherFund: 'bank' },
      sourceCol
    ) === 'إشعار إضافة بنكي',
  'bank receipt notice'
);
assert(
  sourceCol &&
    getRowCellValue(
      { sourceType: 'CP', sourceKind: 'PAYMENT_VOUCHER', voucherFund: 'cash' },
      sourceCol
    ) === 'سند صرف',
  'cash payment stays سند صرف'
);
assert(
  getDefaultVisibleColumnIds(ledgerCols).length === ledgerCols.length,
  'default shows every pickable column'
);

const salesLike = getDefaultVisibleColumnIds([
  { id: 'a', label: 'أ', defaultVisible: true },
  { id: 'b', label: 'ب', defaultVisible: false },
  { id: 'c', label: 'ج', technical: true, defaultVisible: false },
]);
assert(salesLike.join(',') === 'a,b', 'hidden recommended cols still default on');

const orderLimitCols = getReportColumnsForPath('inventory/reports/items-exceeding-order-limit', [
  { warehouseName: 'الرئيسي', itemName: 'صنف' },
]);
assert(orderLimitCols[0]?.label === 'اسم المخزن', 'warehouse header');
assert(orderLimitCols[2]?.label === 'اسم الصنف', 'item header');
assert(
  orderLimitCols.some((c) => c.label === 'حد الطلب'),
  'order limit header'
);

const priceListCols = getReportColumnsForPath('inventory/reports/price-list', [{ itemName: 'صنف' }]);
assert(
  priceListCols.map((c) => c.label).join('|') ===
    'كود الصنف|اسم الصنف|قائمة الأسعار|الوحدة|سعر شراء الصنف|سعر بيع الصنف|سعر شراء قائمة السعر|سعر بيع قائمة السعر',
  'price list has four prices'
);
assert(
  priceListCols.filter((c) => c.format === 'money').every((c) => c.totalMode === 'none'),
  'price list has no totals'
);

const salesCols = getReportColumnsForPath('inventory/reports/sales-reports', [{ invoiceNumber: '1' }]);
assert(salesCols[0]?.id === 'invoiceNumber', 'sales invoice number first');
assert(salesCols[1]?.id === 'invoicePattern' && salesCols[1]?.label === 'نوعها', 'sales type after number');

const customerFxCols = getReportColumnsForPath('inventory/reports/customer-accounts-currency-reports', []);
assert(customerFxCols[0]?.id === 'partyCode', 'customer currency code first');
assert(customerFxCols[1]?.id === 'partyName' && customerFxCols[1]?.label === 'العميل', 'customer name second');
assert(
  customerFxCols.some((c) => c.id === 'debit_EGP' && c.label === 'مدين جنيه مصري'),
  'default EGP debit column'
);

const multiFxCols = partyCurrencyStatementColumns('العميل', [
  { code: 'EGP', name: 'جنيه مصري' },
  { code: 'EUR', name: 'يورو' },
]);
assert(multiFxCols[0]?.id === 'partyCode' && multiFxCols[1]?.id === 'partyName', 'party identity first');
assert(multiFxCols.some((c) => c.id === 'debit_EUR' && c.label === 'مدين يورو'), 'EUR debit column');
assert(multiFxCols.some((c) => c.id === 'balance_EUR' && c.totalMode === 'last'), 'EUR running balance');

const fxSummary = flattenSummaryEntries({
  currencies: [
    { code: 'EGP', name: 'جنيه مصري', debit: 10, credit: 2, balance: 8 },
    { code: 'EUR', name: 'يورو', debit: 5, credit: 1, balance: 4 },
  ],
});
assert(fxSummary[0]?.label === 'إجمالي المبالغ المدينة جنيه مصري', 'EGP debit summary');
assert(fxSummary.some((row) => row.key === 'balance_EUR' && row.label === 'الرصيد يورو'), 'EUR balance summary');

const invoiceProfitCols = getReportColumnsForPath('inventory/reports/invoices-profit-reports', []);
assert(invoiceProfitCols[0]?.id === 'invoiceNumber', 'invoice profit number first');
assert(invoiceProfitCols[1]?.id === 'invoicePattern' && invoiceProfitCols[1]?.label === 'نوعها', 'invoice type after number');
assert(
  invoiceProfitCols.map((c) => c.id).slice(5, 9).join(',') ===
    'totalCost,additionsAmount,discountsAmount,netAdditionsAndDiscounts',
  'additions after cost'
);
assert(
  invoiceProfitCols.slice(-3).map((c) => c.id).join(',') ===
    'profitPercentOnSales,profitPercentOnCost,profitPercentOnTotal',
  'three profit ratios last'
);

const posCols = getReportColumnsForPath('pos/daily', [{ invoiceNumber: '1' }]);
assert(posCols.some((c) => c.id === 'paymentType'), 'pos daily has payment type');
assert(getDefaultVisibleColumnIds(posCols).length === posCols.length, 'pos daily shows all columns');

const centerCols = getReportColumnsForPath('accounting/account-reports/books/cost-center-ledger', [
  {
    accountName: '100 — الإدارة',
    costCenterName: '411 — مصروف',
    counterpartAccount: '121 — الصندوق',
    debitBase: 10,
    creditBase: 0,
    runningBalance: 10,
    exchangeRate: 1,
    sourceType: 'CP',
  },
]);
assert(centerCols.find((c) => c.id === 'accountName')?.label === 'مركز التكلفة', 'center name header');
assert(centerCols.find((c) => c.id === 'costCenterName')?.label === 'الحساب', 'center account header');
const centerAccount = centerCols.find((c) => c.id === 'costCenterName');
const centerCounterpart = centerCols.find((c) => c.id === 'counterpartAccount');
assert(centerAccount?.format === 'text', 'center account stays text');
assert(centerCounterpart?.label === 'الحساب المقابل', 'counterpart header');
assert(centerCounterpart?.format === 'text', 'counterpart stays text');
assert(
  formatReportCell('411 — مصروف', centerAccount?.format ?? 'money').text === '411 — مصروف',
  'account label is shown as written'
);
assert(
  formatReportCell('121 — الصندوق', centerCounterpart?.format ?? 'money').text === '121 — الصندوق',
  'counterpart is shown as written'
);
assert(centerCols.find((c) => c.id === 'debitBase')?.totalMode === 'withOpening', 'debit is totaled');
assert(centerCols.find((c) => c.id === 'creditBase')?.totalMode === 'withOpening', 'credit is totaled');
assert(centerCols.find((c) => c.id === 'runningBalance')?.totalMode === 'net', 'balance is the net');
assert(centerCols.find((c) => c.id === 'exchangeRate')?.totalMode === 'none', 'rate is not totaled');
const centerSource = centerCols.find((c) => c.id === 'sourceType');
assert(
  centerSource && getRowCellValue({ rowKind: 'total', sourceType: 'CP' }, centerSource) === '',
  'total row has no document type'
);

const centerFooter = ledgerFooterFigures([
  { rowKind: 'opening', debitBase: 10, creditBase: 0, runningBalance: 10 },
  { debitBase: 40, creditBase: 0, runningBalance: 50 },
  { debitBase: 0, creditBase: 15, runningBalance: 35 },
  { rowKind: 'total', debitBase: 50, creditBase: 15, runningBalance: 95 },
]);
assert(centerFooter?.debit === 50, 'footer debit includes opening once');
assert(centerFooter?.credit === 15, 'footer credit');
assert(centerFooter?.balance === 35, 'footer balance is debit minus credit');

const trialCols = getReportColumnsForPath('accounting/account-reports/balances/review-balance', [
  { code: '121', arabicName: 'الصندوق', accountType: 'asset' },
]);
const trialType = trialCols.find((c) => c.id === 'accountType');
assert(trialType?.label === 'نوع الحساب', 'trial balance type header');
assert(trialType?.format === 'text', 'account type stays text');
assert(
  formatReportCell(
    trialType ? getRowCellValue({ accountType: 'asset' }, trialType) : '',
    trialType?.format ?? 'text'
  ).text === 'أصول',
  'asset is shown in the account type column'
);
assert(trialType && getRowCellValue({ accountType: 'asset' }, trialType) === 'أصول', 'asset');
assert(trialType && getRowCellValue({ accountType: 'liability' }, trialType) === 'التزامات', 'liability');
assert(trialType && getRowCellValue({ accountType: 'equity' }, trialType) === 'حقوق الملكية', 'equity');
assert(trialType && getRowCellValue({ accountType: 'revenue' }, trialType) === 'إيرادات', 'revenue');
assert(trialType && getRowCellValue({ accountType: 'expense' }, trialType) === 'مصروفات', 'expense');
assert(accountTypeLabel('cogs') === 'تكلفة المبيعات', 'cogs');

const journalListCols = getReportColumnsForPath('accounting/account-reports/books/daily-journal', [
  { entryExchangeRate: 1, debit: 10 },
]);
assert(
  journalListCols.find((c) => c.id === 'entryExchangeRate')?.totalMode === 'none',
  'daily journal list does not total the exchange rate'
);

console.log('reportColumns.test.ts ok');
test('report column assertions', () => {});
