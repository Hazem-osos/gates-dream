import {
  decideHistoricalCashImport,
  decideHistoricalInvoiceImport,
} from '../../modules/migration-engine/commercial/commercial-document-decision';
import {
  mapLegacyInvoiceKind,
  transformHistoricalInvoiceHeader,
} from '../../modules/migration-engine/transforms/commercial-document-transform';
import {
  cashHeaderSelectSql,
  invoiceHeaderSelectSql,
} from '../../modules/migration-engine/services/legacy-commercial-data.service';

describe('commercial-document-migration', () => {
  it('maps legacy SI01/PI01 module types', () => {
    expect(mapLegacyInvoiceKind('SI01')?.invoiceKind).toBe('SALE');
    expect(mapLegacyInvoiceKind('PI01')?.invoiceKind).toBe('PURCHASE');
    expect(mapLegacyInvoiceKind('SR01')?.invoiceKind).toBe('SALE_RETURN');
  });

  it('blocks invoice import when journal link required but missing', () => {
    const d = decideHistoricalInvoiceImport({
      type: 'SI01',
      glNum: '00000080',
      journalEntryId: null,
      alreadyMapped: false,
      requireJournalLink: true,
    });
    expect(d.action).toBe('BLOCK');
  });

  it('allows import when journal is linked', () => {
    const d = decideHistoricalInvoiceImport({
      type: 'PI01',
      glNum: '00000080',
      journalEntryId: 'je-1',
      alreadyMapped: false,
      requireJournalLink: true,
    });
    expect(d.action).toBe('IMPORT');
  });

  it('maps BP01 as payment and BR01 as receipt kinds', () => {
    const { transformHistoricalCashHeader } = require('../../modules/migration-engine/transforms/commercial-document-transform');
    const pay = transformHistoricalCashHeader(
      { Type: 'BP01', CashNum: '1', Amount: 10, GLNum: '1', Date: new Date() },
      { companyId: 'c', journalEntryId: 'je' }
    );
    const rec = transformHistoricalCashHeader(
      { Type: 'BR01', CashNum: '2', Amount: 10, GLNum: '1', Date: new Date() },
      { companyId: 'c', journalEntryId: 'je' }
    );
    expect(pay.transactionKind).toBe('PAYMENT');
    expect(rec.transactionKind).toBe('RECEIPT');
  });

  it('blocks cash without GLNum', () => {
    const d = decideHistoricalCashImport({
      glNum: '',
      journalEntryId: 'je-1',
      alreadyMapped: false,
    });
    expect(d.action).toBe('BLOCK');
  });

  it('does not SELECT fixture-only InvoiceTrxHeader columns', () => {
    for (const col of [
      'RemainingValue',
      'NetValue',
      'TotalValue',
      'DiscountValue',
      'DaribaValue',
      'CustomerCode',
      'SupplierCode',
      'Discount',
    ]) {
      expect(invoiceHeaderSelectSql).not.toMatch(new RegExp(`h\\.${col}\\b`));
    }
    expect(invoiceHeaderSelectSql).toMatch(/h\.NetAmount/);
    expect(invoiceHeaderSelectSql).toMatch(/h\.TotalAmount/);
    expect(invoiceHeaderSelectSql).toMatch(/h\.SalesDaribaAmount/);
    expect(invoiceHeaderSelectSql).toMatch(/h\.SupplierAccountCode/);
    expect(invoiceHeaderSelectSql).toMatch(/h\.OfferAmount/);
    expect(invoiceHeaderSelectSql).toMatch(/NetAmount.*PaidAmount/s);
  });

  it('does not SELECT fixture-only CashTrxHeader columns', () => {
    for (const col of ['TrxNum', 'VoucherNum', 'CustomerCode', 'SupplierCode', 'AccountCode', 'Value', 'CashType']) {
      expect(cashHeaderSelectSql).not.toMatch(new RegExp(`h\\.${col}\\b`));
    }
    expect(cashHeaderSelectSql).toMatch(/h\.AccountNo/);
    expect(cashHeaderSelectSql).toMatch(/h\.CashNum/);
    expect(cashHeaderSelectSql).toMatch(/h\.Amount/);
  });

  it('derives remaining from NetAmount minus PaidAmount when RemainingValue is absent', () => {
    const row = transformHistoricalInvoiceHeader(
      { Type: 'SI01', InvoiceNum: '1', NetAmount: 100, PaidAmount: 40, Date: new Date() },
      { companyId: 'c' }
    );
    expect(Number(row.netAmount)).toBe(100);
    expect(Number(row.paidAmount)).toBe(40);
    expect(Number(row.remainingAmount)).toBe(60);
    expect(row.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('maps catalog InvoiceTrxHeader amounts (NetAmount / TotalAmount / OfferAmount / SalesDaribaAmount)', () => {
    const row = transformHistoricalInvoiceHeader(
      {
        Type: 'SI01',
        InvoiceNum: '1',
        TotalAmount: 120,
        OfferAmount: 10,
        SalesDaribaAmount: 14,
        NetAmount: 124,
        PaidAmount: 0,
        Date: new Date(),
      },
      { companyId: 'c' }
    );
    expect(Number(row.totalAmount)).toBe(120);
    expect(Number(row.discountAmount)).toBe(10);
    expect(Number(row.taxAmount)).toBe(14);
    expect(Number(row.netAmount)).toBe(124);
    expect(Number(row.remainingAmount)).toBe(124);
    expect(row.paymentStatus).toBe('UNPAID');
  });
});
