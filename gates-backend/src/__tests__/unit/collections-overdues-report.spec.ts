import {
  appliedCollectionAmount,
  buildCollectionsOverdueRows,
} from '../../modules/inventory/services/collections-overdues-sheet';

const asOf = new Date('2026-09-28T23:59:59.999Z');
const customer = { id: 'c1', code: '10', arabicName: 'عميل جديد' };

describe('collections and overdues sheet', () => {
  it('keeps a posted invoice and a receipt that settled it', () => {
    const rows = buildCollectionsOverdueRows({
      customers: [customer],
      invoices: [
        {
          customerId: 'c1',
          date: new Date('2026-09-20T00:00:00.000Z'),
          dueDate: new Date('2026-09-20T00:00:00.000Z'),
          netAmount: 1500,
          remainingAmount: 0,
        },
      ],
      cash: [
        {
          customerId: 'c1',
          date: new Date('2026-09-21T00:00:00.000Z'),
          amount: 1500,
          allocatedAmount: 1500,
        },
      ],
      asOf,
      allAccounts: false,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      invoiceCount: 1,
      totalSales: 1500,
      totalCollections: 1500,
      currentDue: 0,
      overdueAmount: 0,
      balance: 0,
      daysOverdue: 0,
    });
  });

  it('splits remaining into current and overdue after the due date', () => {
    const rows = buildCollectionsOverdueRows({
      customers: [customer],
      invoices: [
        {
          customerId: 'c1',
          date: new Date('2026-08-01T00:00:00.000Z'),
          dueDate: new Date('2026-08-10T00:00:00.000Z'),
          netAmount: 1000,
          remainingAmount: 600,
        },
        {
          customerId: 'c1',
          date: new Date('2026-09-28T00:00:00.000Z'),
          dueDate: new Date('2026-10-10T00:00:00.000Z'),
          netAmount: 400,
          remainingAmount: 400,
        },
      ],
      cash: [
        {
          customerId: 'c1',
          date: new Date('2026-08-15T00:00:00.000Z'),
          amount: 400,
          allocatedAmount: 400,
        },
      ],
      asOf,
      allAccounts: false,
    });

    expect(rows[0].totalSales).toBe(1400);
    expect(rows[0].totalCollections).toBe(400);
    expect(rows[0].currentDue).toBe(400);
    expect(rows[0].overdueAmount).toBe(600);
    expect(rows[0].balance).toBe(1000);
    expect(rows[0].daysOverdue).toBe(49);
    expect(rows[0].oldestDueDate).toBe('2026-08-10');
  });

  it('shows an unallocated receipt as a credit without inventing overdue', () => {
    const rows = buildCollectionsOverdueRows({
      customers: [customer],
      invoices: [],
      cash: [
        {
          customerId: 'c1',
          date: new Date('2026-09-01T00:00:00.000Z'),
          amount: 250,
          allocatedAmount: 0,
        },
      ],
      asOf,
      allAccounts: false,
    });

    expect(rows[0].totalCollections).toBe(250);
    expect(rows[0].balance).toBe(-250);
    expect(rows[0].overdueAmount).toBe(0);
    expect(rows[0].daysOverdue).toBe(0);
  });

  it('splits installments into not-yet-due and already-due', () => {
    const rows = buildCollectionsOverdueRows({
      customers: [customer],
      invoices: [
        {
          customerId: 'c1',
          date: new Date('2026-08-01T00:00:00.000Z'),
          dueDate: new Date('2026-10-01T00:00:00.000Z'),
          netAmount: 500,
          remainingAmount: 500,
          installments: [
            {
              dueDate: new Date('2026-08-01T00:00:00.000Z'),
              amount: 300,
              paidAmount: 0,
              isPaid: false,
            },
            {
              dueDate: new Date('2026-10-01T00:00:00.000Z'),
              amount: 200,
              paidAmount: 0,
              isPaid: false,
            },
          ],
        },
      ],
      cash: [],
      asOf,
      allAccounts: false,
    });

    expect(rows[0].currentDue).toBe(200);
    expect(rows[0].overdueAmount).toBe(300);
    expect(rows[0].balance).toBe(500);
  });

  it('nets an unallocated collection against what is already due first', () => {
    const rows = buildCollectionsOverdueRows({
      customers: [customer],
      invoices: [
        {
          customerId: 'c1',
          date: new Date('2026-08-01T00:00:00.000Z'),
          dueDate: new Date('2026-08-10T00:00:00.000Z'),
          netAmount: 600,
          remainingAmount: 600,
        },
        {
          customerId: 'c1',
          date: new Date('2026-09-01T00:00:00.000Z'),
          dueDate: new Date('2026-10-20T00:00:00.000Z'),
          netAmount: 400,
          remainingAmount: 400,
        },
      ],
      cash: [
        {
          customerId: 'c1',
          date: new Date('2026-09-01T00:00:00.000Z'),
          amount: 250,
          allocatedAmount: 0,
        },
      ],
      asOf,
      allAccounts: false,
    });

    expect(rows[0].totalCollections).toBe(250);
    expect(rows[0].overdueAmount).toBe(350);
    expect(rows[0].currentDue).toBe(400);
    expect(rows[0].balance).toBe(750);
  });

  it('treats a linked receipt with no allocation rows as fully applied', () => {
    expect(appliedCollectionAmount(1500, 0, true)).toBe(1500);
    expect(appliedCollectionAmount(1500, 400, true)).toBe(400);
    expect(appliedCollectionAmount(250, 0, false)).toBe(0);
  });

  it('hides idle customers unless every account is requested', () => {
    const idle = { id: 'c2', code: '11', arabicName: 'بدون حركة' };
    const hidden = buildCollectionsOverdueRows({
      customers: [customer, idle],
      invoices: [],
      cash: [],
      asOf,
      allAccounts: false,
    });
    const shown = buildCollectionsOverdueRows({
      customers: [customer, idle],
      invoices: [],
      cash: [],
      asOf,
      allAccounts: true,
    });

    expect(hidden).toHaveLength(0);
    expect(shown.map((row) => row.customer.id).sort()).toEqual(['c1', 'c2']);
  });
});
