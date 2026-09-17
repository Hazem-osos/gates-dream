import { getDefaultVisibleColumnIds, getReportColumnsForPath } from './reportColumns';
import { labelForAutoColumn } from './reportColumnLabels';

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

const posCols = getReportColumnsForPath('pos/daily', [{ invoiceNumber: '1' }]);
assert(posCols.some((c) => c.id === 'paymentType'), 'pos daily has payment type');
assert(getDefaultVisibleColumnIds(posCols).length === posCols.length, 'pos daily shows all columns');

console.log('reportColumns.test.ts ok');
