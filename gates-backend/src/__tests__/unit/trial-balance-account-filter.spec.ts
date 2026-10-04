import {
  arrangeTrialBalanceTree,
  buildCostCenterProfitability,
  buildMonthlyPerformance,
  isTradingStatementAccount,
  ledgerSectionClose,
  idsWithBudgetedLineage,
  selectTrialBalanceRows,
} from '../../modules/accounting/services/financial-report.util';

const tree = [
  { id: 'assets', parentId: null },
  { id: 'cash', parentId: 'assets' },
  { id: 'bank', parentId: 'assets' },
  { id: 'sales', parentId: null },
];

const rows = [
  { accountId: 'assets', code: '1', openingNet: 0, periodDebit: 0, periodCredit: 0 },
  { accountId: 'cash', code: '11', openingNet: 10, periodDebit: 5, periodCredit: 1 },
  { accountId: 'bank', code: '12', openingNet: 0, periodDebit: 20, periodCredit: 4 },
  { accountId: 'sales', code: '4', openingNet: 0, periodDebit: 0, periodCredit: 100 },
];

describe('budgeted account lineage', () => {
  it('keeps a budgeted account and the parents above it', () => {
    const keep = idsWithBudgetedLineage(tree, ['cash']);
    expect([...keep].sort()).toEqual(['assets', 'cash']);
  });

  it('returns an empty set when no account has a budget', () => {
    expect(idsWithBudgetedLineage(tree, []).size).toBe(0);
  });
});

describe('trial balance account filter', () => {
  it('keeps the selected account and the accounts under it', () => {
    const selected = selectTrialBalanceRows(rows, { accountId: 'assets', tree });
    expect(selected.map((row) => row.accountId)).toEqual(['assets', 'cash', 'bank']);
  });

  it('rolls a group account up from the accounts posted under it', () => {
    const [assets] = selectTrialBalanceRows(rows, { accountId: 'assets', level: 1, tree });
    expect(assets.accountId).toBe('assets');
    expect(assets.openingNet).toBe(10);
    expect(assets.periodDebit).toBe(25);
    expect(assets.periodCredit).toBe(5);
  });

  it('does not include another root when an account is selected', () => {
    const selected = selectTrialBalanceRows(rows, { accountId: 'cash', tree });
    expect(selected.map((row) => row.accountId)).toEqual(['cash']);
  });

  it('lists a main account, then the branch under it, then the next branch', () => {
    const treeWithChild = [
      ...tree,
      { id: 'petty', parentId: 'cash' },
    ];
    const withChild = [
      ...rows,
      { accountId: 'petty', code: '111', openingNet: 3, periodDebit: 1, periodCredit: 0 },
    ];
    const ordered = arrangeTrialBalanceTree(withChild, treeWithChild);
    expect(ordered.map((row) => row.accountId)).toEqual(['assets', 'cash', 'petty', 'bank', 'sales']);
    expect(ordered.map((row) => row.depth)).toEqual([0, 1, 2, 1, 0]);
    expect(ordered[0].isGroup).toBe(true);
    expect(ordered[0].periodDebit).toBe(26);
    expect(ordered[2].isGroup).toBe(false);
  });
});

describe('monthly financial performance', () => {
  const row = (
    month: number,
    year: number,
    cls: 'REVENUE' | 'COGS' | 'EXPENSE',
    amount: number,
    accountId: string = cls
  ) => ({
    year,
    month,
    class: cls,
    amount,
    accountId,
    code: accountId,
    arabicName: accountId,
  });

  it('closes the month as revenue minus cost minus expenses, and compares it with the month before', () => {
    const snapshot = buildMonthlyPerformance(2026, 3, [
      row(3, 2026, 'REVENUE', 1000),
      row(3, 2026, 'COGS', 400),
      row(3, 2026, 'EXPENSE', 100, 'rent'),
      row(3, 2026, 'EXPENSE', 50, 'power'),
      row(2, 2026, 'REVENUE', 800),
      row(2, 2026, 'COGS', 300),
      row(2, 2026, 'EXPENSE', 100, 'rent'),
      row(3, 2025, 'REVENUE', 700),
      row(3, 2025, 'COGS', 200),
      row(3, 2025, 'EXPENSE', 100, 'rent'),
    ]);
    expect(snapshot.current.grossProfit).toBe(600);
    expect(snapshot.current.netProfit).toBe(450);
    expect(snapshot.current.grossMargin).toBe(60);
    expect(snapshot.current.netMargin).toBe(45);
    expect(snapshot.previousMonth.netProfit).toBe(400);
    expect(snapshot.versusPrevious.netProfit.amount).toBe(50);
    expect(snapshot.sameMonthLastYear.netProfit).toBe(400);
    expect(snapshot.months).toHaveLength(12);
    expect(snapshot.months[0].label).toBe('يناير');
    expect(snapshot.topExpenses.map((item) => item.accountId)).toEqual(['rent', 'power']);
  });

  it('uses December of the previous year when January is selected', () => {
    const snapshot = buildMonthlyPerformance(2026, 1, [
      row(1, 2026, 'REVENUE', 100),
      row(12, 2025, 'REVENUE', 40),
    ]);
    expect(snapshot.previousMonth.month).toBe(12);
    expect(snapshot.previousMonth.year).toBe(2025);
    expect(snapshot.versusPrevious.revenue.amount).toBe(60);
  });
});

describe('cost center profitability', () => {
  it('ranks the profitable center first and keeps amounts posted without a center aside', () => {
    const line = (
      costCenterId: string | null,
      cls: 'REVENUE' | 'COGS' | 'EXPENSE',
      amount: number,
      month = 3
    ) => ({ year: 2026, month, costCenterId, class: cls, amount });
    const report = buildCostCenterProfitability(
      2026,
      3,
      [
        line('cairo', 'REVENUE', 1000),
        line('cairo', 'EXPENSE', 200),
        line('alex', 'REVENUE', 400),
        line('alex', 'EXPENSE', 500),
        line(null, 'EXPENSE', 80),
        line('cairo', 'REVENUE', 100, 1),
      ],
      [
        { id: 'cairo', code: '01', arabicName: 'القاهرة' },
        { id: 'alex', code: '02', arabicName: 'الإسكندرية' },
      ]
    );
    expect(report.centers.map((center) => center.id)).toEqual(['cairo', 'alex']);
    expect(report.centers[0].netProfit).toBe(800);
    expect(report.centers[1].netProfit).toBe(-100);
    expect(report.companyNet).toBe(700);
    expect(report.centers[0].share).toBeCloseTo(114.2857, 3);
    expect(report.unassigned.netProfit).toBe(-80);
    expect(report.centers[0].months[0].netProfit).toBe(100);
    expect(report.centers[0].months[2].netProfit).toBe(800);
  });
});

describe('ledger account footer', () => {
  it('adds the opening into total debit so the balance equals debit minus credit', () => {
    const close = ledgerSectionClose([
      { debitBase: 40, creditBase: 0, runningBalance: 50 },
      { debitBase: 0, creditBase: 15, runningBalance: 35 },
    ]);
    expect(close.opening).toBe(10);
    expect(close.openingDebit).toBe(10);
    expect(close.debit).toBe(50);
    expect(close.credit).toBe(15);
    expect(close.balance).toBe(35);
    expect(close.debit - close.credit).toBe(close.balance);
  });

  it('puts a credit opening on the credit side', () => {
    const close = ledgerSectionClose([{ debitBase: 5, creditBase: 0, runningBalance: -20 }]);
    expect(close.opening).toBe(-25);
    expect(close.openingCredit).toBe(25);
    expect(close.debit).toBe(5);
    expect(close.credit).toBe(25);
    expect(close.balance).toBe(-20);
  });
});

describe('trading account accounts', () => {
  it('includes sales and cost of sales, and leaves administrative expenses out', () => {
    expect(isTradingStatementAccount({ code: '411', arabicName: 'إيرادات المبيعات', accountType: 'revenue' })).toBe(true);
    expect(isTradingStatementAccount({ code: '511', arabicName: 'تكلفة البضاعة المباعة', accountType: 'expense' })).toBe(true);
    expect(isTradingStatementAccount({ code: '51', arabicName: 'تكلفة النشاط والمبيعات', accountType: 'expense' })).toBe(true);
    expect(isTradingStatementAccount({ code: '521', arabicName: 'الرواتب والأجور', accountType: 'expense' })).toBe(false);
    expect(isTradingStatementAccount({ code: '121', arabicName: 'العملاء', accountType: 'asset' })).toBe(false);
  });
});
