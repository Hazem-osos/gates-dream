import {
  buildOverduePaymentSheet,
  documentTypeLabel,
  filterOverduePaymentRows,
  paymentMethodLabel,
  type OverdueInvoiceInput,
} from '../../modules/inventory/services/overdue-payments-report';

const asOf = new Date('2026-03-18T23:59:59.999Z');

function invoice(overrides: Partial<OverdueInvoiceInput> = {}): OverdueInvoiceInput {
  return {
    invoiceDate: new Date('2026-02-18T00:00:00.000Z'),
    dueDate: new Date('2026-02-18T00:00:00.000Z'),
    invoiceNumber: '000001',
    partyName: 'محمد الخليل',
    invoiceTotal: 8500,
    paidAmount: 8500,
    postedAt: new Date('2026-02-18T00:00:00.000Z'),
    installments: [
      {
        dueDate: new Date('2026-02-18T00:00:00.000Z'),
        amount: 8500,
        paidAmount: 8500,
        isPaid: true,
        status: 'PAID',
        paymentDate: new Date('2026-02-18T00:00:00.000Z'),
      },
    ],
    ...overrides,
  };
}

describe('overdue payment schedule', () => {
  it('keeps a fully paid installment and measures age to the period end', () => {
    const report = buildOverduePaymentSheet([invoice()], asOf);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      documentType: 'فاتورة مبيعات',
      paymentStatus: 'مسددة بالكامل',
      remainingAmount: 0,
      debtAge: 28,
      daysLate: 28,
      delayKind: 'متأخرة',
      penaltyRate: 0,
      penaltyAmount: 0,
      settlementDate: '2026-02-18',
      paidAmount: 8500,
    });
    expect(report.summary.totalPayments).toBe(8500);
    expect(report.summary.totalSettled).toBe(8500);
    expect(report.summary.totalRemaining).toBe(0);
    expect(report.summary.totalOverdue).toBe(0);
  });

  it('marks unpaid, partial, and not-yet-due installments on the same invoice', () => {
    const report = buildOverduePaymentSheet(
      [
        invoice({
          invoiceNumber: '000004',
          invoiceKind: 'PURCHASE',
          partyName: 'مورد حديد',
          invoiceTotal: 12000,
          paidAmount: 4000,
          installments: [
            {
              dueDate: new Date('2026-03-01T00:00:00.000Z'),
              amount: 4000,
              paidAmount: 0,
              isPaid: false,
              status: 'PENDING',
              paymentDate: null,
            },
            {
              dueDate: new Date('2026-03-10T00:00:00.000Z'),
              amount: 4000,
              paidAmount: 1500,
              isPaid: false,
              status: 'PARTIALLY_PAID',
              paymentDate: null,
            },
            {
              dueDate: new Date('2026-04-01T00:00:00.000Z'),
              amount: 4000,
              paidAmount: 0,
              isPaid: false,
              status: 'PENDING',
              paymentDate: null,
            },
          ],
        }),
      ],
      asOf
    );

    expect(report.rows.map((row) => row.paymentStatus)).toEqual(['متأخرة', 'مسددة جزئيا', 'لم تستحق']);
    expect(report.rows.map((row) => row.remainingAmount)).toEqual([4000, 2500, 4000]);
    expect(report.rows.map((row) => row.paidAmount)).toEqual([0, 1500, 0]);
    expect(report.rows[0].documentType).toBe('فاتورة مشتريات');
    expect(report.rows[2].daysLate).toBe(0);
    expect(report.rows[2].delayKind).toBe('في الموعد');
    expect(report.summary.totalPayments).toBe(12000);
    expect(report.summary.totalRemaining).toBe(10500);
    expect(report.summary.totalOverdue).toBe(6500);
    expect(report.summary.totalInvoices).toBe(1);
  });

  it('uses the invoice itself when there is no installment schedule, and the profile name as the type', () => {
    const report = buildOverduePaymentSheet(
      [
        invoice({
          profileName: 'إذن صرف عمليات',
          invoiceTotal: 520,
          paidAmount: 520,
          installments: [],
        }),
      ],
      asOf
    );
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].documentType).toBe('إذن صرف عمليات');
    expect(report.rows[0].paymentStatus).toBe('مسددة بالكامل');
    expect(report.rows[0].paymentAmount).toBe(520);
    expect(documentTypeLabel({ invoiceKind: 'SALE' })).toBe('فاتورة مبيعات');
  });

  it('names cash, bank, and the cheque status as the payment method', () => {
    expect(paymentMethodLabel([{ channel: 'cash' }])).toBe('نقدي');
    expect(paymentMethodLabel([{ channel: 'bank' }])).toBe('بنك');
    expect(paymentMethodLabel([{ channel: 'cheque', chequeStatus: 'SENT_TO_BANK' }])).toBe('مرسل للبنك');

    const report = buildOverduePaymentSheet(
      [
        invoice({
          invoiceNumber: '000010',
          settlements: [{ channel: 'cheque', chequeStatus: 'UNDER_HAND' }],
        }),
        invoice({
          invoiceNumber: '000011',
          paidAmount: 0,
          postedAt: null,
          installments: [
            {
              dueDate: new Date('2026-03-01T00:00:00.000Z'),
              amount: 8500,
              paidAmount: 0,
              isPaid: false,
              status: 'PENDING',
              paymentDate: null,
              settlements: [{ channel: 'bank' }],
            },
          ],
        }),
      ],
      asOf
    );
    expect(report.rows.map((row) => row.paymentMethod)).toEqual(['تحت اليد', 'بنك']);

    const late = filterOverduePaymentRows(report.rows, { debtOrder: 'overdue', daysLateOp: 'gte', daysLateDays: 10 });
    expect(late.rows.map((row) => row.invoiceNumber)).toEqual(['000011']);
    expect(late.summary.totalInvoices).toBe(1);

    const bank = filterOverduePaymentRows(report.rows, { paymentChannel: 'bank' });
    expect(bank.rows.map((row) => row.paymentMethod)).toEqual(['بنك']);
  });
});
