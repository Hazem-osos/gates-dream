import { buildCustomerBalanceRows } from '../../modules/inventory/services/customer-balances-sheet';

const fromDate = new Date('2026-01-01T00:00:00.000Z');
const toDate = new Date('2026-12-31T23:59:59.999Z');

const customer = {
  id: 'c1',
  code: '10',
  arabicName: 'عميل جديد',
};

describe('customer balances sheet', () => {
  it('keeps a posted invoice and a receipt that settled it', () => {
    const rows = buildCustomerBalanceRows({
      customers: [customer],
      invoices: [
        {
          customerId: 'c1',
          kind: 'SALE',
          date: new Date('2026-09-28T10:00:00.000Z'),
          netAmount: 1500,
        },
      ],
      cash: [
        {
          customerId: 'c1',
          kind: 'RECEIPT',
          date: new Date('2026-09-28T12:00:00.000Z'),
          amount: 1500,
        },
      ],
      fromDate,
      toDate,
      allAccounts: false,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].accountLabel).toBe('10-عميل جديد');
    expect(rows[0].previousBalance).toBe(0);
    expect(rows[0].debit).toBe(1500);
    expect(rows[0].credit).toBe(1500);
    expect(rows[0].currentBalance).toBe(0);
    expect(rows[0].budget).toBe(0);
    expect(rows[0].budgetRemaining).toBe(0);
    expect(rows[0].customer?.arabicName).toBe('عميل جديد');
  });

  it('shows an open invoice and a receipt on opposite sides', () => {
    const rows = buildCustomerBalanceRows({
      customers: [customer],
      invoices: [
        {
          customerId: 'c1',
          kind: 'SALE',
          date: new Date('2026-09-28T10:00:00.000Z'),
          netAmount: 1000,
        },
      ],
      cash: [
        {
          customerId: 'c1',
          kind: 'RECEIPT',
          date: new Date('2026-09-28T12:00:00.000Z'),
          amount: 400,
        },
      ],
      fromDate,
      toDate,
      allAccounts: false,
    });

    expect(rows[0].debit).toBe(1000);
    expect(rows[0].credit).toBe(400);
    expect(rows[0].currentBalance).toBe(600);
    expect(rows[0].budgetRemaining).toBe(600);
  });

  it('shows a receipt with no invoice as a credit balance', () => {
    const rows = buildCustomerBalanceRows({
      customers: [customer],
      invoices: [],
      cash: [
        {
          customerId: 'c1',
          kind: 'RECEIPT',
          date: new Date('2026-09-28T12:00:00.000Z'),
          amount: 250,
        },
      ],
      fromDate,
      toDate,
      allAccounts: false,
    });

    expect(rows[0].debit).toBe(0);
    expect(rows[0].credit).toBe(250);
    expect(rows[0].currentBalance).toBe(-250);
    expect(rows[0].budgetRemaining).toBe(-250);
  });

  it('hides a customer with no movement unless every account is requested', () => {
    const idle = { id: 'c2', code: '11', arabicName: 'بدون حركة' };
    const hidden = buildCustomerBalanceRows({
      customers: [customer, idle],
      invoices: [],
      cash: [],
      fromDate,
      toDate,
      allAccounts: false,
    });
    const shown = buildCustomerBalanceRows({
      customers: [customer, idle],
      invoices: [],
      cash: [],
      fromDate,
      toDate,
      allAccounts: true,
    });

    expect(hidden).toHaveLength(0);
    expect(shown.map((row) => row.customer?.id).sort()).toEqual(['c1', 'c2']);
  });

  it('keeps opening movement in the previous balance and period movement in debit and credit', () => {
    const rows = buildCustomerBalanceRows({
      customers: [customer],
      invoices: [
        {
          customerId: 'c1',
          kind: 'SALE',
          date: new Date('2025-12-01T00:00:00.000Z'),
          netAmount: 800,
        },
        {
          customerId: 'c1',
          kind: 'SALE_RETURN',
          date: new Date('2026-03-01T00:00:00.000Z'),
          netAmount: 100,
        },
      ],
      cash: [
        {
          customerId: 'c1',
          kind: 'PAYMENT',
          date: new Date('2026-04-01T00:00:00.000Z'),
          amount: 50,
        },
      ],
      fromDate,
      toDate,
      allAccounts: false,
    });

    expect(rows[0].previousBalance).toBe(800);
    expect(rows[0].debit).toBe(50);
    expect(rows[0].credit).toBe(100);
    expect(rows[0].currentBalance).toBe(750);
  });

  it('puts the parent account first as the sum of its customers', () => {
    const rows = buildCustomerBalanceRows({
      customers: [
        {
          id: 'c1',
          code: '10',
          arabicName: 'محمد',
          accountCode: '102020101002',
          parentAccountCode: '102020101001',
          parentAccountName: 'العملاء',
          budget: 0,
        },
        {
          id: 'c2',
          code: '11',
          arabicName: 'أسيد',
          accountCode: '102020101005',
          parentAccountCode: '102020101001',
          parentAccountName: 'العملاء',
          budget: 100,
        },
      ],
      invoices: [
        {
          customerId: 'c1',
          kind: 'SALE',
          date: new Date('2026-09-28T10:00:00.000Z'),
          netAmount: 1500,
        },
      ],
      cash: [
        {
          customerId: 'c2',
          kind: 'RECEIPT',
          date: new Date('2026-09-28T12:00:00.000Z'),
          amount: 400,
        },
      ],
      fromDate,
      toDate,
      allAccounts: false,
    });

    expect(rows.map((row) => row.accountLabel)).toEqual([
      '102020101001-العملاء',
      '102020101002-محمد',
      '102020101005-أسيد',
    ]);
    expect(rows[0].isGroup).toBe(true);
    expect(rows[0].debit).toBe(1500);
    expect(rows[0].credit).toBe(400);
    expect(rows[0].currentBalance).toBe(1100);
    expect(rows[0].budget).toBe(100);
    expect(rows[0].budgetRemaining).toBe(1000);
    expect(rows[2].currentBalance).toBe(-400);
    expect(rows[2].budgetRemaining).toBe(-500);
  });
});
