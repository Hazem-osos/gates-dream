'use client';

type Row = Record<string, unknown>;

type SideLine = {
  code: string;
  name: string;
  amount: number;
  depth: number;
  group: boolean;
};

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value.trim() : '';
}

function formatAmount(value: number): string {
  return Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const GENERAL_EXPENSES = 'المصروفات العمومية والإدارية';

function underGeneralExpenses(row: Row): { groupPath: string; groupNames: string } | null {
  const own = text(row, 'arabicName');
  const codes = text(row, 'groupPath').split('|');
  const names = text(row, 'groupNames').split('|');
  const index = names.findIndex((name) => name.replace(/\s+/g, ' ').trim() === GENERAL_EXPENSES);
  if (index >= 0) {
    return {
      groupPath: codes.slice(index).join('|'),
      groupNames: names.slice(index).join('|'),
    };
  }
  if (own.replace(/\s+/g, ' ').trim() === GENERAL_EXPENSES) {
    return { groupPath: '', groupNames: '' };
  }
  return null;
}

function buildTree(
  rows: Array<{ code: string; name: string; amount: number; groupPath: string; groupNames: string }>
): SideLine[] {
  type Node = SideLine & { children: Node[] };
  const byCode = new Map<string, Node>();

  const ensure = (code: string, name: string, depth: number): Node => {
    const existing = byCode.get(code);
    if (existing) return existing;
    const node: Node = { code, name, amount: 0, depth, group: false, children: [] };
    byCode.set(code, node);
    return node;
  };

  for (const row of rows) {
    const codes = row.groupPath ? row.groupPath.split('|').filter(Boolean) : [];
    const names = row.groupNames ? row.groupNames.split('|') : [];
    let parent: Node | null = null;
    codes.forEach((code, index) => {
      const node = ensure(code, names[index] || code, index);
      if (parent && !parent.children.includes(node)) parent.children.push(node);
      parent = node;
    });
    const leaf = ensure(row.code, row.name, codes.length);
    leaf.amount += row.amount;
    if (parent && !parent.children.includes(leaf)) parent.children.push(leaf);
  }

  const roots = [...byCode.values()].filter((node) => node.depth === 0);
  const rollup = (node: Node): number => {
    if (!node.children.length) return node.amount;
    node.group = true;
    const childrenTotal = node.children.reduce((sum, child) => sum + rollup(child), 0);
    node.amount = node.amount + childrenTotal;
    return node.amount;
  };
  roots.forEach(rollup);

  const ordered: SideLine[] = [];
  const walk = (nodes: Node[]) => {
    nodes
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, 'ar'))
      .forEach((node) => {
        ordered.push(node);
        walk(node.children);
      });
  };
  walk(roots);
  return ordered;
}

function sideTotal(lines: SideLine[]): number {
  return lines.filter((line) => line.depth === 0).reduce((sum, line) => sum + line.amount, 0);
}

export function ProfitLossSheet({
  rows,
  summary,
  compareRows = [],
  currentYearLabel,
  compareYearLabel,
}: {
  rows: Row[];
  summary?: unknown;
  compareRows?: Row[];
  currentYearLabel?: string;
  compareYearLabel?: string;
}) {
  const currencyName =
    summary && typeof summary === 'object' && typeof (summary as Row).currencyName === 'string'
      ? String((summary as Row).currencyName)
      : 'جنيه مصري';
  const expenses = buildTree(
    rows.flatMap((row) => {
      if (text(row, 'class') !== 'EXPENSE' || num(row.amount) === 0) return [];
      const scope = underGeneralExpenses(row);
      if (!scope) return [];
      return [
        {
          code: text(row, 'code'),
          name: text(row, 'arabicName') || text(row, 'code'),
          amount: Math.abs(num(row.amount)),
          groupPath: scope.groupPath,
          groupNames: scope.groupNames,
        },
      ];
    })
  );

  const compareExpenses = buildTree(
    compareRows.flatMap((row) => {
      if (text(row, 'class') !== 'EXPENSE' || num(row.amount) === 0) return [];
      const scope = underGeneralExpenses(row);
      if (!scope) return [];
      return [
        {
          code: text(row, 'code'),
          name: text(row, 'arabicName') || text(row, 'code'),
          amount: Math.abs(num(row.amount)),
          groupPath: scope.groupPath,
          groupNames: scope.groupNames,
        },
      ];
    })
  );
  const compareByCode = new Map(compareExpenses.map((line) => [line.code, line.amount]));
  const creditLines: SideLine[] = [];
  const debitLines = expenses;
  const showCompare = Boolean(compareYearLabel);
  const yearHeader = currentYearLabel || 'المجموع';
  const compareDebitSum = compareExpenses.filter((line) => line.depth === 0).reduce((sum, line) => sum + line.amount, 0);

  const debitSum = sideTotal(debitLines);
  const creditSum = sideTotal(creditLines);
  const profit = creditSum - debitSum;
  const grand = Math.max(debitSum, creditSum);
  const rowCount = Math.max(debitLines.length, creditLines.length, 12);

  return (
    <div className="report-scroll-viewport erp-scroll-x overflow-x-auto bg-white" dir="rtl">
      <p className="mb-1 text-right text-sm text-slate-800">العملة {currencyName}</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#3b8fc2] text-white">
            {showCompare ? (
              <th className="w-36 border border-[#2f78a6] px-2 py-2 font-semibold">{compareYearLabel}</th>
            ) : null}
            <th className="w-36 border border-[#2f78a6] px-2 py-2 font-semibold">{yearHeader}</th>
            <th className="border border-[#2f78a6] px-3 py-2 text-right font-semibold">الحساب</th>
            {showCompare ? (
              <th className="w-36 border border-[#2f78a6] px-2 py-2 font-semibold">{compareYearLabel}</th>
            ) : null}
            <th className="w-36 border border-[#2f78a6] px-2 py-2 font-semibold">{yearHeader}</th>
            <th className="border border-[#2f78a6] px-3 py-2 text-right font-semibold">الحساب</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, index) => {
            const debit = debitLines[index];
            const credit = creditLines[index];
            return (
              <tr key={index} className="h-8">
                {showCompare ? (
                  <td className="border border-slate-300 px-2 text-center">
                    {debit ? formatAmount(compareByCode.get(debit.code) ?? 0) : ''}
                  </td>
                ) : null}
                <td className="border border-slate-300 px-2 text-center">
                  {debit ? formatAmount(debit.amount) : ''}
                </td>
                <td
                  className={`border border-slate-300 px-2 text-right ${debit?.group ? 'font-semibold text-red-600' : 'text-slate-900'}`}
                  style={{ paddingRight: debit ? 8 + debit.depth * 16 : undefined }}
                >
                  {debit ? `${debit.code} ${debit.name}`.trim() : ''}
                </td>
                {showCompare ? <td className="border border-slate-300 px-2 text-center" /> : null}
                <td className="border border-slate-300 px-2 text-center">
                  {credit ? formatAmount(credit.amount) : ''}
                </td>
                <td
                  className={`border border-slate-300 px-2 text-right ${credit?.group ? 'font-semibold text-red-600' : 'text-slate-900'}`}
                  style={{ paddingRight: credit ? 8 + credit.depth * 16 : undefined }}
                >
                  {credit ? `${credit.code} ${credit.name}`.trim() : ''}
                </td>
              </tr>
            );
          })}
          <tr className="bg-[#d9eef8] font-bold text-slate-900">
            {showCompare ? (
              <td className="border border-slate-300 px-2 py-1.5 text-center">{formatAmount(compareDebitSum)}</td>
            ) : null}
            <td className="border border-slate-300 px-2 py-1.5 text-center">{formatAmount(debitSum)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right">المجموع</td>
            {showCompare ? <td className="border border-slate-300 px-2 py-1.5 text-center" /> : null}
            <td className="border border-slate-300 px-2 py-1.5 text-center">{formatAmount(creditSum)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right">المجموع</td>
          </tr>
          <tr className="bg-[#d9eef8] font-bold text-slate-900">
            {showCompare ? (
              <td className="border border-slate-300 px-2 py-1.5 text-center">
                {compareDebitSum > 0 ? formatAmount(compareDebitSum) : ''}
              </td>
            ) : null}
            <td className="border border-slate-300 px-2 py-1.5 text-center">
              {profit > 0 ? formatAmount(profit) : ''}
            </td>
            <td className="border border-slate-300 px-2 py-1.5 text-right">{profit > 0 ? 'صافي' : ''}</td>
            {showCompare ? <td className="border border-slate-300 px-2 py-1.5 text-center" /> : null}
            <td className="border border-slate-300 px-2 py-1.5 text-center">
              {profit < 0 ? formatAmount(profit) : ''}
            </td>
            <td className="border border-slate-300 px-2 py-1.5 text-right">{profit < 0 ? 'صافي' : ''}</td>
          </tr>
          <tr className="bg-[#d9eef8] font-bold text-slate-900">
            {showCompare ? (
              <td className="border border-slate-300 px-2 py-1.5 text-center">{formatAmount(compareDebitSum)}</td>
            ) : null}
            <td className="border border-slate-300 px-2 py-1.5 text-center">{formatAmount(grand)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right">المجموع العام</td>
            {showCompare ? (
              <td className="border border-slate-300 px-2 py-1.5 text-center">{formatAmount(compareDebitSum)}</td>
            ) : null}
            <td className="border border-slate-300 px-2 py-1.5 text-center">{formatAmount(grand)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right">المجموع العام</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
