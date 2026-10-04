'use client';

type Row = Record<string, unknown>;

type StatementLine = {
  name: string;
  amount?: number;
  compareAmount?: number;
  kind: 'section' | 'detail' | 'total';
};

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value.trim() : '';
}

function formatAmount(value: number): string {
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `(${abs})` : abs;
}

function linesOf(rows: Row[], accountClass: string): Row[] {
  return rows
    .filter((row) => text(row, 'class') === accountClass && num(row.amount) !== 0)
    .sort((a, b) => text(a, 'code').localeCompare(text(b, 'code'), 'ar'));
}

function summaryNumber(summary: unknown, key: string): number | null {
  if (!summary || typeof summary !== 'object') return null;
  const value = (summary as Record<string, unknown>)[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

export function IncomeStatementSheet({
  rows,
  summary,
  compareRows = [],
  compareSummary,
  currentYearLabel,
  compareYearLabel,
}: {
  rows: Row[];
  summary?: unknown;
  compareRows?: Row[];
  compareSummary?: unknown;
  currentYearLabel?: string;
  compareYearLabel?: string;
}) {
  const revenue = linesOf(rows, 'REVENUE');
  const cogs = linesOf(rows, 'COGS');
  const expenses = linesOf(rows, 'EXPENSE');
  const sum = (list: Row[]) => list.reduce((total, row) => total + num(row.amount), 0);

  const netSales = summaryNumber(summary, 'totalRevenue') ?? sum(revenue);
  const cost = summaryNumber(summary, 'costOfGoodsSold') ?? sum(cogs);
  const gross = summaryNumber(summary, 'grossProfit') ?? netSales - cost;
  const netExpenses = summaryNumber(summary, 'totalExpenses') ?? sum(expenses);
  const netProfit = summaryNumber(summary, 'netProfit') ?? gross - netExpenses;
  const compareAmountOf = (row: Row) => {
    const match = compareRows.find(
      (item) => text(item, 'code') === text(row, 'code') && text(item, 'class') === text(row, 'class')
    );
    return match ? num(match.amount) : 0;
  };
  const compareRevenue = linesOf(compareRows, 'REVENUE');
  const compareCogs = linesOf(compareRows, 'COGS');
  const compareExpenses = linesOf(compareRows, 'EXPENSE');
  const compareNetSales = summaryNumber(compareSummary, 'totalRevenue') ?? sum(compareRevenue);
  const compareCost = summaryNumber(compareSummary, 'costOfGoodsSold') ?? sum(compareCogs);
  const compareGross = summaryNumber(compareSummary, 'grossProfit') ?? compareNetSales - compareCost;
  const compareNetExpenses = summaryNumber(compareSummary, 'totalExpenses') ?? sum(compareExpenses);
  const compareNetProfit = summaryNumber(compareSummary, 'netProfit') ?? compareGross - compareNetExpenses;
  const showCompare = Boolean(compareYearLabel);

  const statement: StatementLine[] = [
    { name: 'المبيعات', kind: 'section' },
    ...revenue.map((row) => ({ name: text(row, 'arabicName') || text(row, 'code'), amount: num(row.amount), compareAmount: compareAmountOf(row), kind: 'detail' as const })),
    { name: 'صافي المبيعات', amount: netSales, compareAmount: compareNetSales, kind: 'total' },
    { name: 'تكلفة البضاعة المباعة', amount: cost, compareAmount: compareCost, kind: 'total' },
    { name: 'مجمل الربح', amount: gross, compareAmount: compareGross, kind: 'total' },
    { name: 'المصاريف', kind: 'section' },
    ...expenses.map((row) => ({ name: text(row, 'arabicName') || text(row, 'code'), amount: num(row.amount), compareAmount: compareAmountOf(row), kind: 'detail' as const })),
    { name: 'صافي المصروفات', amount: -Math.abs(netExpenses), compareAmount: -Math.abs(compareNetExpenses), kind: 'total' },
    { name: 'صافي الربح', amount: netProfit, compareAmount: compareNetProfit, kind: 'total' },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white" dir="rtl">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#eef7fb] text-[#0b4f73]">
            {showCompare ? (
              <th className="w-36 border border-slate-300 px-2 py-2">{compareYearLabel}</th>
            ) : null}
            <th className="w-36 border border-slate-300 px-2 py-2">{currentYearLabel || 'الإجمالي'}</th>
            <th className="w-36 border border-slate-300 px-2 py-2">التفاصيل</th>
            <th className="border border-slate-300 px-3 py-2 text-right">البيان</th>
          </tr>
        </thead>
        <tbody>
          {statement.map((line, index) => {
            if (line.kind === 'section') {
              return (
                <tr key={`${line.name}-${index}`}>
                  {showCompare ? <td className="border border-slate-200" /> : null}
                  <td className="border border-slate-200" />
                  <td className="border border-slate-200" />
                  <td className="border border-slate-200 px-3 py-2 text-right font-bold text-red-600">{line.name}</td>
                </tr>
              );
            }
            const negative = (line.amount ?? 0) < 0;
            const amountClass = `border border-slate-200 px-2 py-1 text-center ${
              line.kind === 'total' || negative ? 'font-semibold text-red-600' : 'text-slate-900'
            }`;
            return (
              <tr key={`${line.name}-${index}`} className={line.kind === 'total' ? 'bg-slate-50' : undefined}>
                {showCompare ? (
                  <td className={amountClass}>{formatAmount(line.compareAmount ?? 0)}</td>
                ) : null}
                <td className={amountClass}>
                  {currentYearLabel || line.kind === 'total' ? formatAmount(line.amount ?? 0) : ''}
                </td>
                <td className={amountClass}>
                  {!currentYearLabel && line.kind === 'detail' ? formatAmount(line.amount ?? 0) : ''}
                </td>
                <td
                  className={`border border-slate-200 px-3 py-1 text-right ${
                    line.kind === 'total' ? 'font-bold text-red-600' : 'text-slate-800'
                  }`}
                >
                  {line.name}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
