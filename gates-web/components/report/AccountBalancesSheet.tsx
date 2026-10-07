'use client';

import { useApiQuery } from '@/lib/hooks/useApi';

type BalanceRow = {
  account: string;
  depth: number;
  accountKind?: string;
  previousDebit: number;
  previousCredit: number;
  movementDebit: number;
  movementCredit: number;
  currentDebit: number;
  currentCredit: number;
};

const COLUMNS: Array<{ key: keyof BalanceRow; label: string }> = [
  { key: 'previousDebit', label: 'رصيد سابق مدين' },
  { key: 'previousCredit', label: 'رصيد سابق دائن' },
  { key: 'movementDebit', label: 'رصيد حركة مدين' },
  { key: 'movementCredit', label: 'رصيد حركة دائن' },
  { key: 'currentDebit', label: 'رصيد حالي مدين' },
  { key: 'currentCredit', label: 'رصيد حالي دائن' },
];

function money(value: number) {
  if (!value) return '';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AccountBalancesSheet({ query }: { query: Record<string, string> }) {
  const { data, isLoading, isError, error } = useApiQuery<BalanceRow[]>(
    ['account-balances-tree', JSON.stringify(query)],
    '/accounting/reports/account-balances-credit',
    { ...query, limit: 5000 }
  );
  const rows = Array.isArray(data?.data) ? data.data : [];

  if (isLoading) return <p className="py-6 text-center text-sm text-slate-500">جاري تجهيز أرصدة الحسابات…</p>;
  if (isError) {
    return <p className="py-6 text-center text-sm text-red-600">{error?.message || 'تعذر تحميل أرصدة الحسابات'}</p>;
  }
  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-slate-500">لا توجد أرصدة في الفترة المختارة.</p>;
  }

  const cell = 'border border-[#d5e6f0] px-2 py-1';

  return (
    <div dir="rtl" className="report-scroll-viewport erp-scroll-x overflow-x-auto rounded-lg border border-[#9ec3d8] bg-white">
      <table className="w-full min-w-[980px] border-collapse text-xs text-slate-800" dir="rtl">
        <thead>
          <tr className="bg-[#7eb6d9] text-white">
            <th className="border border-[#6aa4c8] px-2 py-2 text-right">الحساب</th>
            {COLUMNS.map((column) => (
              <th key={column.key} className="border border-[#6aa4c8] px-2 py-2 text-center">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const header = row.accountKind === 'HEADER' || row.depth === 0;
            return (
              <tr key={`${row.account}-${index}`} className={header ? 'bg-[#f4fafc] font-semibold' : 'odd:bg-white even:bg-[#f8fbfd]'}>
                <td className={`${cell} text-right`}>
                  <span style={{ paddingInlineStart: `${row.depth * 16}px` }}>{row.account}</span>
                </td>
                {COLUMNS.map((column) => (
                  <td key={column.key} className={`${cell} text-center tabular-nums`}>
                    {money(Number(row[column.key] ?? 0))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
