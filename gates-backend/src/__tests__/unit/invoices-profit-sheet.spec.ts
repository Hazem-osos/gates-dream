import { buildInvoiceProfitSheet } from '../../modules/inventory/services/invoices-profit-sheet';

describe('invoices profit sheet', () => {
  it('puts additions and discounts after cost and folds them into profit', () => {
    const sheet = buildInvoiceProfitSheet([
      {
        id: 'i1',
        invoiceNumber: 'S-10',
        date: new Date('2026-03-02T10:00:00.000Z'),
        invoiceKind: 'SALE',
        customerName: 'عميل',
        invoicePattern: 'فاتورة نقدية',
        totalAmount: 1000,
        lineCost: 700,
        additionsAmount: 50,
        discountsAmount: 20,
      },
    ]);

    expect(sheet.rows).toHaveLength(1);
    expect(sheet.rows[0].invoicePattern).toBe('فاتورة نقدية');
    expect(sheet.rows[0].totalSales).toBe(1000);
    expect(sheet.rows[0].totalCost).toBe(700);
    expect(sheet.rows[0].additionsAmount).toBe(50);
    expect(sheet.rows[0].discountsAmount).toBe(20);
    expect(sheet.rows[0].netAdditionsAndDiscounts).toBe(30);
    expect(sheet.rows[0].profit).toBe(330);
    expect(sheet.rows[0].profitPercentOnSales).toBe(33);
    expect(sheet.rows[0].profitPercentOnCost).toBe(47.14);
    expect(sheet.rows[0].profitPercentOnTotal).toBe(100);
  });

  it('splits the last profit ratio across sales, cost, and the report total', () => {
    const sheet = buildInvoiceProfitSheet([
      {
        id: 'a',
        invoiceNumber: '1',
        date: new Date('2026-01-01T00:00:00.000Z'),
        invoiceKind: 'SALE',
        customerName: 'أ',
        invoicePattern: '',
        totalAmount: 200,
        lineCost: 100,
        additionsAmount: 0,
        discountsAmount: 0,
      },
      {
        id: 'b',
        invoiceNumber: '2',
        date: new Date('2026-01-02T00:00:00.000Z'),
        invoiceKind: 'SALE',
        customerName: 'ب',
        invoicePattern: '',
        totalAmount: 200,
        lineCost: 150,
        additionsAmount: 0,
        discountsAmount: 0,
      },
    ]);

    expect(sheet.rows[0].profit).toBe(100);
    expect(sheet.rows[1].profit).toBe(50);
    expect(sheet.rows[0].profitPercentOnTotal).toBe(66.67);
    expect(sheet.rows[1].profitPercentOnTotal).toBe(33.33);
    expect(sheet.rows[0].date.getTime()).toBeLessThan(sheet.rows[1].date.getTime());
  });
});
