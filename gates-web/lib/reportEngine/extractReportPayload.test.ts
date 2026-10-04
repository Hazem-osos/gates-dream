import { extractReportPayload } from './extractReportPayload';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const stock = extractReportPayload({
  status: 'success',
  data: [
    {
      itemSerial: 'A-1',
      itemName: 'صنف',
      warehouseName: 'المخزن الرئيسي',
      quantityOnHand: 4,
    },
  ],
  summary: { totalItems: 1 },
});
assert(stock.rows.length === 1 && stock.rows[0].itemName === 'صنف', 'flat stock rows');

const invoices = extractReportPayload({
  data: [
    {
      invoiceNumber: 'S-1',
      totalAmount: 100,
      customer: { id: 'c1', arabicName: 'عميل', code: 'C' },
      warehouse: { id: 'w1', arabicName: 'مخزن' },
      lines: [{ quantity: 1 }],
    },
  ],
});
assert(invoices.rows[0].customer === 'عميل', 'flatten customer name');
assert(invoices.rows[0].warehouse === 'مخزن', 'flatten warehouse name');
assert(!('lines' in invoices.rows[0]), 'drop nested line arrays');

const collections = extractReportPayload({
  data: {
    receivables: [{ customer: { arabicName: 'عميل' }, balance: 50 }],
    overdue: [{ invoice: { invoiceNumber: 'S-9', customer: { arabicName: 'عميل' } }, daysOverdue: 3 }],
  },
});
assert(collections.rows.length === 2, 'collections flatten both lists');
assert(collections.rows[1].invoiceNumber === 'S-9', 'hoist nested invoice number');

const journal = extractReportPayload({
  data: [
    {
      id: 'je-1',
      voucherNumber: '12',
      legacyGlNum: '0001',
      isPosted: true,
      isCancelled: false,
      lines: [{ debit: 10, credit: 0, debitBase: 500, creditBase: 0, description: 'سطر' }],
    },
  ],
});
assert(journal.rows[0].debit === 500 && journal.rows[0].credit === 0, 'journal rows use base currency');
assert(journal.rows[0].isPosted === 'مرحّل', 'posted flag is arabic');
assert(journal.rows[0].isCancelled === 'غير ملغي', 'cancelled flag is arabic');
assert(!('legacyGlNum' in journal.rows[0]), 'one journal number column');

const tax = extractReportPayload({
  data: { salesTax: 10, purchaseTax: 4, netTax: 6 },
});
assert(tax.rows.length === 1 && tax.rows[0].netTax === 6, 'scalar object becomes a row');

const costCenters = extractReportPayload({
  data: [
    {
      accountId: 'a1',
      code: '511',
      account: 'تكلفة المبيعات',
      cells: { cc1: { debit: 80, credit: 30, balance: 50 } },
    },
  ],
  summary: { centers: [{ id: 'cc1', code: '10', name: 'الإدارة' }] },
});
assert(
  (costCenters.rows[0].cells as { cc1: { debit: number; credit: number; balance: number } }).cc1.debit === 80 &&
    (costCenters.rows[0].cells as { cc1: { balance: number } }).cc1.balance === 50,
  'cost center review keeps debit credit and balance'
);

console.log('extractReportPayload.test.ts ok');
test('extract report payload assertions', () => {});
