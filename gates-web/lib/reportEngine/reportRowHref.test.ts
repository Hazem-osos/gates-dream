import { parseReportNumber } from './reportFormatters';
import { movementDocumentHref } from '../accounting/journal-source';
import {
  accountLedgerHref,
  financialPaperHref,
  invoiceNumberHref,
  isInvoiceNumberColumn,
  isJournalNumberColumn,
  operationNumberHref,
  isItemCodeColumn,
  itemMovementHref,
  journalEntryHref,
} from './reportRowHref';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(
  journalEntryHref({
    journalEntryId: 'je-1',
    sourceId: 'inv-1',
    sourceType: 'SALES_INVOICE',
    legacyGlNum: '0001',
  }) === '/accounting/operations/journal-entry?id=je-1',
  'journal id wins over source'
);
assert(journalEntryHref({ sourceId: 'inv-1', sourceType: 'SALES_INVOICE' }) === null, 'no journal');
assert(
  movementDocumentHref('SI', 'inv-1') === '/inventory/operations/sales-invoice?invoiceId=inv-1',
  'sales invoice movement'
);
assert(
  movementDocumentHref('OB', 'open-1') === '/inventory/operations/opening-stock?id=open-1',
  'opening stock movement'
);
assert(
  movementDocumentHref('MO', 'mo-1') === '/manufacturing/operations/operation?orderId=mo-1',
  'manufacturing order movement'
);
assert(movementDocumentHref('OB', '') === null, 'opening balance without a document');
assert(isJournalNumberColumn({ id: 'legacyGlNum', label: 'رقم القيد' }), 'legacy number');
assert(isJournalNumberColumn({ id: 'sourceNumber', label: 'رقم المصدر' }) === false, 'source number');
assert(
  operationNumberHref(
    { id: 'sourceNumber', label: 'رقم المصدر' },
    { sourceNumber: 'S-9', sourceType: 'SI', sourceId: 'inv-9', journalEntryId: 'je-9' }
  ) === '/inventory/operations/sales-invoice?invoiceId=inv-9',
  'source number opens the invoice'
);
assert(
  operationNumberHref(
    { id: 'voucherNumber', label: 'رقم القيد' },
    { voucherNumber: '12', sourceType: 'SI', sourceId: 'inv-9', journalEntryId: 'je-9' }
  ) === '/accounting/operations/journal-entry?id=je-9',
  'journal number stays on the journal'
);
assert(
  operationNumberHref(
    { id: 'documentNumber', label: 'الرقم' },
    { documentNumber: 'RV-1', sourceType: 'CR', sourceKind: 'RECEIPT_VOUCHER', sourceId: 'cash-1', journalEntryId: 'je-2' }
  ) === '/accounting/operations/treasury/open?id=cash-1',
  'document number opens the voucher'
);
assert(
  operationNumberHref(
    { id: 'documentNumber', label: 'الرقم' },
    {
      documentNumber: '1',
      sourceType: 'CP',
      sourceKind: 'PAYMENT_VOUCHER',
      sourceId: 'bank-1',
      voucherFund: 'bank',
      journalEntryId: 'je-3',
    }
  ) === '/accounting/operations/banks/bank-discount?id=bank-1',
  'bank debit notice opens its own screen'
);
assert(
  operationNumberHref({ id: 'itemSerial', label: 'كود الصنف' }, { itemSerial: '100', itemId: 'item-1' }) === null,
  'item code is not an operation number'
);
assert(
  operationNumberHref(
    { id: 'paperNumber', label: 'رقم الورقة' },
    { paperNumber: '44', id: 'ch-1', paperType: 'شيك قبض' }
  ) === '/accounting/cheques/incoming?id=ch-1',
  'paper number opens the cheque'
);
assert(isInvoiceNumberColumn({ id: 'invoiceNumber', label: 'رقم الفاتورة' }), 'invoice column');
assert(
  operationNumberHref(
    { id: 'invoiceNumber', label: 'رقم العملية' },
    { invoiceNumber: 'ي-9', invoicePreviewPath: '/accounting/operations/journal-entry?id=je-1' }
  ) === '/accounting/operations/journal-entry?id=je-1',
  'operation number opens the journal'
);
assert(
  invoiceNumberHref(
    { id: 'inv-1', invoiceNumber: 'S-1', invoiceKind: 'SALE', journalEntryId: 'je-9' },
    'inventory/reports/sales-reports'
  ) === '/inventory/operations/sales-invoice?invoiceId=inv-1',
  'invoice number opens the invoice'
);
assert(parseReportNumber('١٬٢٥٠٫٥٠ ج.م') === 1250.5, 'arabic money');
assert(parseReportNumber('1,250.50') === 1250.5, 'grouped money');
assert(parseReportNumber(0) === 0, 'zero stays');
assert(
  accountLedgerHref(
    { accountId: 'acc-1', code: '1101' },
    { fromDate: '2026-01-01', toDate: '2026-12-31', costCenterId: 'cc-1' }
  ) ===
    '/accounting/account-reports/books/daftar-ostaz?accountId=acc-1&fromDate=2026-01-01&toDate=2026-12-31&costCenterId=cc-1',
  'trial balance code opens the ledger'
);
assert(accountLedgerHref({ code: '1101' }) === null, 'code without account id');
assert(
  itemMovementHref(
    { itemId: 'item-1', warehouseId: 'wh-1', itemName: 'صنف' },
    { fromDate: '2026-01-01', toDate: '2026-12-31' }
  ) ===
    '/inventory/reports/item-movement-reports?itemId=item-1&warehouseId=wh-1&fromDate=2026-01-01&toDate=2026-12-31',
  'stock row opens item movement'
);
assert(itemMovementHref({ itemName: 'صنف' }) === null, 'movement link needs an item');
assert(isItemCodeColumn({ id: 'itemSerial' }), 'item code column');
assert(isItemCodeColumn({ id: 'itemName' }) === false, 'name is not the code column');
assert(
  financialPaperHref({ id: 'ch-1', paperType: 'شيك قبض' }) === '/accounting/cheques/incoming?id=ch-1',
  'inward cheque opens its screen'
);
assert(
  financialPaperHref({ id: 'p-1', paperType: 'ورقة دفع' }) ===
    '/accounting/operations/securities/payment?id=p-1',
  'payment paper opens its screen'
);

test('journal entry link from report rows', () => {});
