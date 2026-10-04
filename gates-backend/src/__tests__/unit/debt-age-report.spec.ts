import { buildDebtAgeSheet, type DebtAgeInvoice } from '../../modules/inventory/services/debt-age-report';

const asOf = new Date('2026-09-27T23:59:59.999Z');

function invoice(overrides: Partial<DebtAgeInvoice> = {}): DebtAgeInvoice {
  return {
    invoiceDate: new Date('2026-02-18T00:00:00.000Z'),
    invoiceNumber: '000002',
    invoiceKind: 'SALE',
    partyName: 'محمد الخليل',
    invoiceTotal: 79151,
    paidAmount: 6000,
    remainingAmount: 73151,
    lastPaymentDate: new Date('2026-02-18T00:00:00.000Z'),
    ...overrides,
  };
}

describe('debt age sheet', () => {
  it('ages an open invoice from its date and from the last settlement', () => {
    const report = buildDebtAgeSheet(
      [
        invoice(),
        invoice({
          invoiceNumber: '000001',
          invoiceDate: new Date('2026-02-25T00:00:00.000Z'),
          profileName: 'إذن صرف عمليات',
          partyName: 'حساب عمليات تحت التنفيذ',
          invoiceTotal: 1250,
          paidAmount: 0,
          remainingAmount: 1250,
          lastPaymentDate: null,
        }),
        invoice({
          invoiceNumber: '000007',
          invoiceKind: 'PURCHASE',
          partyName: 'ابتسامة يوسف',
          invoiceTotal: 12000,
          paidAmount: 0,
          remainingAmount: 12000,
          lastPaymentDate: new Date('2026-05-05T00:00:00.000Z'),
        }),
      ],
      asOf
    );

    expect(report.rows[0]).toMatchObject({
      documentType: 'فاتورة مبيعات',
      ageFromInvoice: 221,
      ageFromLastPayment: 221,
      lastPaymentDate: '2026-02-18',
      paidAmount: 6000,
      remainingAmount: 73151,
    });
    expect(report.rows[1]).toMatchObject({
      documentType: 'إذن صرف عمليات',
      lastPaymentDate: null,
      ageFromInvoice: 214,
      ageFromLastPayment: 214,
    });
    expect(report.rows[2].documentType).toBe('فاتورة مشتريات');
    expect(report.rows[2].ageFromInvoice).toBe(221);
    expect(report.rows[2].ageFromLastPayment).toBe(145);
    expect(report.summary.totalSettled).toBe(6000);
    expect(report.summary.totalRemaining).toBe(73151 + 1250 + 12000);
    expect(report.summary.totalInvoices).toBe(3);
  });

  it('filters age from the invoice and from the last payment with from/to', () => {
    const invoices = [
      invoice({ invoiceNumber: 'A', lastPaymentDate: new Date('2026-02-18T00:00:00.000Z') }),
      invoice({
        invoiceNumber: 'B',
        invoiceDate: new Date('2026-02-25T00:00:00.000Z'),
        paidAmount: 0,
        remainingAmount: 1250,
        invoiceTotal: 1250,
        lastPaymentDate: null,
      }),
      invoice({
        invoiceNumber: 'C',
        invoiceKind: 'PURCHASE',
        lastPaymentDate: new Date('2026-05-05T00:00:00.000Z'),
        paidAmount: 0,
        remainingAmount: 12000,
        invoiceTotal: 12000,
      }),
    ];

    const byInvoice = buildDebtAgeSheet(invoices, asOf, {
      ageFromInvoice: { from: 215, to: 221 },
    });
    expect(byInvoice.rows.map((row) => row.invoiceNumber)).toEqual(['A', 'C']);
    expect(byInvoice.summary.totalInvoices).toBe(2);

    const byPayment = buildDebtAgeSheet(invoices, asOf, {
      ageFromLastPayment: { from: 140, to: 160 },
    });
    expect(byPayment.rows.map((row) => row.invoiceNumber)).toEqual(['C']);
    expect(byPayment.rows[0].ageFromLastPayment).toBe(145);
  });
});