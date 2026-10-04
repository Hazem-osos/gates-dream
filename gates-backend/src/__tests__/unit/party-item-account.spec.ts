import {
  buildPartyItemStatement,
  invoiceLineLedger,
  journalMovementLabel,
  lineInclusiveValue,
  type PartyItemDraft,
} from '../../modules/inventory/services/party-item-account';

function draft(overrides: Partial<PartyItemDraft> = {}): PartyItemDraft {
  return {
    partyId: 'c1',
    partyCode: '102020101001',
    partyName: 'محمد الخليل',
    date: '2026-02-18T00:00:00.000Z',
    invoiceNumber: '00000001',
    description: 'فاتورة مبيعات',
    itemName: 'كشاف',
    itemGroupName: 'صلب',
    itemCategoryName: 'أرضية',
    unitName: 'عدد',
    quantity: 50,
    unitPrice: 80,
    debit: 4520,
    credit: 0,
    ...overrides,
  };
}

describe('party item account', () => {
  it('shows the item line then the cash collection and a running balance', () => {
    const report = buildPartyItemStatement(
      [
        draft(),
        draft({
          invoiceNumber: 'ق-12',
          description: 'تم تحصيل كاش',
          itemName: '',
          itemGroupName: '',
          itemCategoryName: '',
          unitName: '',
          quantity: null,
          unitPrice: null,
          debit: 0,
          credit: 4520,
        }),
      ],
      [],
      { partyLabel: 'العميل', page: 1, limit: 50 }
    );

    expect(report.data[0]).toMatchObject({
      accountPath: 'العميل   102020101001   محمد الخليل',
      itemName: 'كشاف',
      itemGroupName: 'صلب',
      itemCategoryName: 'أرضية',
      quantity: 50,
      unitPrice: 80,
      debit: 4520,
      runningBalance: 4520,
    });
    expect(report.data[1]).toMatchObject({
      description: 'تم تحصيل كاش',
      invoiceNumber: 'ق-12',
      credit: 4520,
      runningBalance: 0,
    });
    expect(report.data[2]).toMatchObject({
      rowKind: 'total',
      description: 'الإجمالي',
      debit: 4520,
      credit: 4520,
      runningBalance: 0,
    });
    expect(report.summary.closingBalance).toBe(0);
  });

  it('starts from the opening balance before the period', () => {
    const report = buildPartyItemStatement(
      [draft({ debit: 100, credit: 0 })],
      [{ partyId: 'c1', partyCode: '102020101001', partyName: 'محمد الخليل', amount: 40 }],
      { partyLabel: 'العميل', fromDate: '2026-02-01T00:00:00.000Z', page: 1, limit: 50 }
    );
    expect(report.data[0]).toMatchObject({ rowKind: 'opening', runningBalance: 40 });
    expect(report.data[1].runningBalance).toBe(140);
    expect(report.data[2]).toMatchObject({
      rowKind: 'total',
      debit: 100,
      credit: 0,
      runningBalance: 140,
    });
  });

  it('keeps a daily journal and a settlement on the customer statement', () => {
    const report = buildPartyItemStatement(
      [
        draft(),
        draft({
          invoiceNumber: 'ي-9',
          description: journalMovementLabel('MANUAL', 'قيد يومية تسوية مصروف'),
          itemName: '',
          quantity: null,
          unitPrice: null,
          debit: 200,
          credit: 0,
        }),
        draft({
          invoiceNumber: 'ت-3',
          description: journalMovementLabel('COUNTERPARTY_OFFSET', 'قيد مقاصة تسوية — محمد الخليل'),
          itemName: '',
          quantity: null,
          unitPrice: null,
          debit: 0,
          credit: 4720,
        }),
      ],
      [],
      { partyLabel: 'العميل', page: 1, limit: 50 }
    );
    expect(report.data.map((row) => row.description)).toEqual([
      'فاتورة مبيعات',
      'قيد يومية تسوية مصروف',
      'قيد مقاصة تسوية — محمد الخليل',
      'الإجمالي',
    ]);
    expect(report.data[3]).toMatchObject({ debit: 4720, credit: 4720, runningBalance: 0 });
  });
});

describe('invoice line values', () => {
  it('keeps each row value and posts the invoice net only on the last row', () => {
    const rows = invoiceLineLedger(
      [{ inclusive: 100 }, { inclusive: 250.5 }, { inclusive: 80 }],
      430.5,
      false
    );
    expect(rows).toEqual([
      { lineInclusiveValue: 100, ledgerAmount: 0 },
      { lineInclusiveValue: 250.5, ledgerAmount: 0 },
      { lineInclusiveValue: 80, ledgerAmount: 430.5 },
    ]);
  });

  it('posts each visible line when the report is filtered to one item', () => {
    const rows = invoiceLineLedger([{ inclusive: 80 }, { inclusive: 20 }], 500, true);
    expect(rows.map((row) => row.ledgerAmount)).toEqual([80, 20]);
  });

  it('includes tax and subtracts the line and header discount', () => {
    expect(
      lineInclusiveValue({
        total: 1000,
        discountAmount: 100,
        headerDiscountAllocated: 50,
        taxAmount: 140,
        withholdingTaxAmount: 10,
      })
    ).toBe(980);
  });
});

describe('journalMovementLabel', () => {
  it('names an empty manual journal قيد يومية and an offset تسوية', () => {
    expect(journalMovementLabel('MANUAL', '')).toBe('قيد يومية');
    expect(journalMovementLabel('COUNTERPARTY_OFFSET', '')).toBe('تسوية مقاصة');
    expect(journalMovementLabel('MANUAL', 'تسوية حساب')).toBe('تسوية حساب');
  });
});
