import { buildYearCloseLines } from '../../modules/operations/services/year-close-lines';

describe('year-end closing lines', () => {
  const retained = 'pl';

  it('reverses income-statement balances and credits the profit to the P&L account', () => {
    const { lines, netToRetained } = buildYearCloseLines(
      [
        {
          accountId: 'sales',
          code: '411',
          accountType: 'revenue',
          statementType: 'INCOME_STATEMENT',
          debitSum: 0,
          creditSum: 1000,
        },
        {
          accountId: 'cogs',
          code: '511',
          accountType: 'expense',
          statementType: 'BALANCE_SHEET',
          debitSum: 400,
          creditSum: 0,
        },
        {
          accountId: 'cash',
          code: '121',
          accountType: 'asset',
          statementType: 'BALANCE_SHEET',
          debitSum: 1000,
          creditSum: 0,
        },
      ],
      retained
    );

    expect(netToRetained).toBe(600);
    expect(lines).toEqual([
      { accountId: 'sales', debit: 1000, credit: 0 },
      { accountId: 'cogs', debit: 0, credit: 400 },
      { accountId: retained, debit: 0, credit: 600 },
    ]);
    const debit = lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = lines.reduce((sum, line) => sum + line.credit, 0);
    expect(debit).toBe(credit);
  });

  it('debits the P&L account when the year is a loss', () => {
    const { lines, netToRetained } = buildYearCloseLines(
      [
        {
          accountId: 'sales',
          code: '9',
          accountType: null,
          statementType: 'INCOME_STATEMENT',
          debitSum: 0,
          creditSum: 100,
        },
        {
          accountId: 'expense',
          code: '521',
          accountType: 'expense',
          statementType: 'INCOME_STATEMENT',
          debitSum: 400,
          creditSum: 0,
        },
      ],
      retained
    );

    expect(netToRetained).toBe(-300);
    expect(lines[2]).toEqual({ accountId: retained, debit: 300, credit: 0 });
  });

  it('does not reverse the profit-and-loss account into itself', () => {
    const { lines } = buildYearCloseLines(
      [
        {
          accountId: retained,
          code: '3900',
          accountType: null,
          statementType: 'INCOME_STATEMENT',
          debitSum: 0,
          creditSum: 50,
        },
      ],
      retained
    );
    expect(lines).toEqual([]);
  });
});
