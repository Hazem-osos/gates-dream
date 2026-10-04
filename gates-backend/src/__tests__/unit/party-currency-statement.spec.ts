import {
  buildPartyCurrencySheet,
  currencyColumnKeys,
  mergeAppearingCurrencies,
  type PartyCurrencyLine,
} from '../../modules/inventory/services/party-currency-statement-sheet';

function line(partial: {
  partnerId?: string | null;
  accountId?: string | null;
  currencyCode: string;
  debit?: number;
  credit?: number;
  debitBase?: number;
  creditBase?: number;
  date: string;
  invoiceNumber?: string;
  lineNumber?: number;
}): PartyCurrencyLine {
  return {
    partnerId: partial.partnerId ?? 'c1',
    accountId: partial.accountId ?? 'a1',
    lineNumber: partial.lineNumber ?? 1,
    debit: partial.debit ?? 0,
    credit: partial.credit ?? 0,
    debitBase: partial.debitBase ?? 0,
    creditBase: partial.creditBase ?? 0,
    currencyCode: partial.currencyCode,
    invoiceNumber: partial.invoiceNumber ?? 'INV-1',
    descriptionAr: 'حركة',
    journalEntry: {
      id: `j-${partial.invoiceNumber || '1'}`,
      date: new Date(partial.date),
      sourceNumber: partial.invoiceNumber ?? 'INV-1',
      currencyCode: partial.currencyCode,
    },
  };
}

const currencies = [
  { code: 'EGP', name: 'جنيه مصري' },
  { code: 'EUR', name: 'يورو' },
];

const names = new Map([['c1', { name: 'عميل العملات', code: '10' }]]);

describe('party currency statement sheet', () => {
  it('puts native amounts in each currency and runs a balance per currency', () => {
    const sheet = buildPartyCurrencySheet({
      currencies,
      baseCode: 'EGP',
      names,
      accountToParty: new Map(),
      priorLines: [],
      periodLines: [
        line({
          currencyCode: 'EGP',
          debit: 1500,
          debitBase: 1500,
          date: '2026-03-01T10:00:00.000Z',
          invoiceNumber: 'S-1',
          lineNumber: 1,
        }),
        line({
          currencyCode: 'EUR',
          debit: 100,
          debitBase: 5500,
          date: '2026-03-02T10:00:00.000Z',
          invoiceNumber: 'S-2',
          lineNumber: 1,
        }),
        line({
          currencyCode: 'EUR',
          credit: 40,
          creditBase: 2200,
          date: '2026-03-03T10:00:00.000Z',
          invoiceNumber: 'R-1',
          lineNumber: 1,
        }),
      ],
    });

    expect(sheet.rows).toHaveLength(3);
    expect(sheet.rows[0].partyName).toBe('عميل العملات');
    expect(sheet.rows[0].partyCode).toBe('10');

    const egp = currencyColumnKeys('EGP');
    const eur = currencyColumnKeys('EUR');
    const first = sheet.rows[0] as Record<string, number>;
    expect(first[egp.debit]).toBe(1500);
    expect(first[egp.credit]).toBe(0);
    expect(first[egp.balance]).toBe(1500);
    expect(first[eur.debit]).toBe(0);
    expect(first[eur.balance]).toBe(0);

    const second = sheet.rows[1] as Record<string, number>;
    expect(second[eur.debit]).toBe(100);
    expect(second[eur.balance]).toBe(100);
    expect(second[egp.debit]).toBe(0);
    expect(second[egp.balance]).toBe(1500);

    const third = sheet.rows[2] as Record<string, number>;
    expect(third[eur.credit]).toBe(40);
    expect(third[eur.balance]).toBe(60);
    expect(third[egp.balance]).toBe(1500);

    expect(sheet.summary.currencies).toEqual([
      { code: 'EGP', name: 'جنيه مصري', debit: 1500, credit: 0, balance: 1500 },
      { code: 'EUR', name: 'يورو', debit: 100, credit: 40, balance: 60 },
    ]);
  });

  it('opens from prior journal lines per currency, not a single converted balance', () => {
    const fromDate = new Date('2026-04-01T00:00:00.000Z');
    const sheet = buildPartyCurrencySheet({
      currencies,
      baseCode: 'EGP',
      names,
      accountToParty: new Map(),
      fromDate,
      priorLines: [
        line({
          currencyCode: 'EUR',
          debit: 80,
          debitBase: 4400,
          date: '2026-02-01T10:00:00.000Z',
          invoiceNumber: 'OLD',
        }),
      ],
      periodLines: [
        line({
          currencyCode: 'EGP',
          credit: 200,
          creditBase: 200,
          date: '2026-04-02T10:00:00.000Z',
          invoiceNumber: 'P-1',
        }),
      ],
    });

    const opening = sheet.rows[0] as Record<string, unknown>;
    const egp = currencyColumnKeys('EGP');
    const eur = currencyColumnKeys('EUR');
    expect(opening.description).toBe('رصيد افتتاحي');
    expect(opening[eur.debit]).toBe(80);
    expect(opening[eur.balance]).toBe(80);
    expect(opening[egp.debit]).toBe(0);
    expect(opening[egp.balance]).toBe(0);

    const movement = sheet.rows[1] as Record<string, number>;
    expect(movement[egp.credit]).toBe(200);
    expect(movement[egp.balance]).toBe(-200);
    expect(movement[eur.balance]).toBe(80);
  });

  it('adds an appearing currency that is not in the company list', () => {
    const merged = mergeAppearingCurrencies(
      currencies,
      [line({ currencyCode: 'USD', debit: 10, date: '2026-01-01T00:00:00.000Z' })],
      'EGP',
      false
    );
    expect(merged.map((row) => row.code)).toEqual(['EGP', 'EUR', 'USD']);
    expect(mergeAppearingCurrencies(currencies, [line({ currencyCode: 'USD', debit: 10, date: '2026-01-01T00:00:00.000Z' })], 'EGP', true)).toEqual(
      currencies
    );
  });
});
