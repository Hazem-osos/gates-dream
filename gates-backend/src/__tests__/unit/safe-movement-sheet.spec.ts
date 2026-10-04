import { buildSafeMovementRows } from '../../modules/accounting/services/safe-movement-sheet';

const fromDate = new Date('2026-01-01T00:00:00.000Z');

const safe = {
  id: 'safe-1',
  arabicName: 'الخزينة الرئيسية',
  code: '1',
  glAccountId: 'cash-leaf',
  parentAccountId: 'cash-parent',
};

describe('safe movement sheet', () => {
  it('puts the opening balance before the period and keeps later treasury-account lines', () => {
    const built = buildSafeMovementRows({
      safes: [safe],
      fromDate,
      currencyCode: 'EGP',
      lines: [
        {
          accountId: 'cash-leaf',
          date: new Date('2025-12-31T00:00:00.000Z'),
          debit: 8000,
          credit: 0,
          description: 'رصيد افتتاحي',
          voucherNumber: 'OB',
          journalEntryId: 'je-open',
          entryType: 'OPENING_BALANCE',
        },
        {
          accountId: 'cash-leaf',
          date: new Date('2026-02-01T00:00:00.000Z'),
          debit: 1500,
          credit: 0,
          description: 'فاتورة مبيعات نقدي',
          voucherNumber: 'SI-9',
          journalEntryId: 'je-sale',
          entryType: 'AUTO',
          sourceType: 'SI',
          sourceId: 'inv-9',
          counterpart: 'العملاء',
        },
        {
          accountId: 'cash-leaf',
          date: new Date('2026-02-02T00:00:00.000Z'),
          debit: 0,
          credit: 400,
          description: 'سند صرف',
          voucherNumber: 'PV-3',
          journalEntryId: 'je-pay',
          entryType: 'AUTO',
          counterpart: 'مصروف',
        },
      ],
    });

    expect(built.rows.map((row) => row.type)).toEqual(['رصيد افتتاحي', 'قبض', 'صرف']);
    expect(built.rows[0]).toMatchObject({ rowKind: 'opening', amount: 8000, description: 'رصيد افتتاحي' });
    expect(built.rows[1]).toMatchObject({
      amount: 1500,
      voucherNumber: 'SI-9',
      account: 'العملاء',
      journalEntryId: 'je-sale',
    });
    expect(built.summary).toMatchObject({
      openingBalance: 8000,
      totalReceipts: 1500,
      totalPayments: 400,
      netBalance: 9100,
      closingBalance: 9100,
    });
  });

  it('shows an opening journal inside the period as a treasury movement', () => {
    const built = buildSafeMovementRows({
      safes: [safe],
      fromDate: new Date('2025-01-01T00:00:00.000Z'),
      lines: [
        {
          accountId: 'cash-parent',
          date: new Date('2025-12-31T00:00:00.000Z'),
          debit: 2500,
          credit: 0,
          journalEntryId: 'je-open',
          entryType: 'OPENING_BALANCE',
          description: '',
        },
      ],
    });

    expect(built.rows).toHaveLength(1);
    expect(built.rows[0]).toMatchObject({
      type: 'رصيد افتتاحي',
      rowKind: 'movement',
      amount: 2500,
      description: 'رصيد افتتاحي',
    });
    expect(built.summary.openingBalance).toBe(0);
    expect(built.summary.totalReceipts).toBe(2500);
  });

  it('does not give a shared parent account to more than one safe', () => {
    const built = buildSafeMovementRows({
      safes: [
        safe,
        {
          id: 'safe-2',
          arabicName: 'خزينة فرع',
          code: '2',
          glAccountId: 'cash-leaf-2',
          parentAccountId: 'cash-parent',
        },
      ],
      fromDate,
      lines: [
        {
          accountId: 'cash-parent',
          date: new Date('2025-12-31T00:00:00.000Z'),
          debit: 900,
          credit: 0,
          journalEntryId: 'je-parent',
          entryType: 'OPENING_BALANCE',
        },
        {
          accountId: 'cash-leaf',
          date: new Date('2026-03-01T00:00:00.000Z'),
          debit: 100,
          credit: 0,
          journalEntryId: 'je-leaf',
        },
      ],
    });

    expect(built.rows.map((row) => row.journalEntryId)).toEqual(['je-leaf']);
    expect(built.summary.openingBalance).toBe(0);
    expect(built.summary.totalReceipts).toBe(100);
  });

  it('labels a bank previous balance and keeps the account on the bank column', () => {
    const built = buildSafeMovementRows({
      safes: [
        {
          id: 'bank-1',
          arabicName: 'بنك مصر',
          code: 'B1',
          glAccountId: 'bank-leaf',
          parentAccountId: null,
        },
      ],
      fromDate,
      openingLabel: 'رصيد سابق',
      fundField: 'bankAccount',
      lines: [
        {
          accountId: 'bank-leaf',
          date: new Date('2025-12-31T00:00:00.000Z'),
          debit: 4000,
          credit: 0,
          journalEntryId: 'je-open',
          entryType: 'OPENING_BALANCE',
        },
        {
          accountId: 'bank-leaf',
          date: new Date('2026-04-01T00:00:00.000Z'),
          debit: 0,
          credit: 700,
          journalEntryId: 'je-out',
          description: 'إشعار خصم',
        },
      ],
    });

    expect(built.rows[0]).toMatchObject({
      type: 'رصيد سابق',
      rowKind: 'opening',
      amount: 4000,
      bankAccount: { arabicName: 'بنك مصر' },
    });
    expect(built.rows[1]).toMatchObject({ type: 'صرف', amount: 700 });
    expect(built.summary.openingBalance).toBe(4000);
    expect(built.summary.netBalance).toBe(3300);
  });
});
