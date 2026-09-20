import { saleInvoiceReturnBlockReason } from '../../modules/invoices/services/sale-invoice-return-policy';

function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

describe('saleInvoiceReturnBlockReason', () => {
  it('blocks a sales invoice when returns are not allowed', () => {
    expect(
      saleInvoiceReturnBlockReason({
        invoiceKind: 'SALE',
        allowReturn: false,
        returnDays: 30,
        date: new Date(),
        invoiceNumber: 'S-1',
      })
    ).toBe('فاتورة S-1 غير مسموح بإرجاعها أو عمل مردود عليها');
  });

  it('allows a sales invoice inside the return window', () => {
    expect(
      saleInvoiceReturnBlockReason({
        invoiceKind: 'SALE',
        allowReturn: true,
        returnDays: 30,
        date: daysAgo(10),
        invoiceNumber: 'S-2',
      })
    ).toBeNull();
  });

  it('blocks after the return window expires', () => {
    expect(
      saleInvoiceReturnBlockReason({
        invoiceKind: 'SALE',
        allowReturn: true,
        returnDays: 7,
        date: daysAgo(10),
        invoiceNumber: 'S-3',
      })
    ).toBe('انتهت مدة الاسترجاع لـفاتورة S-3 (7 يوم من تاريخ الفاتورة)');
  });

  it('does not apply the sales-return window to purchase invoices', () => {
    expect(
      saleInvoiceReturnBlockReason({
        invoiceKind: 'PURCHASE',
        allowReturn: false,
        date: new Date(),
      })
    ).toBeNull();
  });
});
