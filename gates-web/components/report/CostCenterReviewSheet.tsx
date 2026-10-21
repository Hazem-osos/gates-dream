'use client';

import { AccountLedgerLink } from '@/components/report/AccountLedgerLink';
import { BalanceRowEye } from '@/components/report/BalanceAnalysisProvider';

type Center = { id: string; code: string; name: string };
type Cell = { debit?: number; credit?: number; balance?: number };
type Row = {
  accountId?: string;
  code?: string;
  account?: string;
  cells?: Record<string, Cell>;
};

function amount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function readCenters(summary: unknown): Center[] {
  if (!summary || typeof summary !== 'object' || !('centers' in summary)) return [];
  const centers = (summary as { centers?: unknown }).centers;
  if (!Array.isArray(centers)) return [];
  return centers.filter(
    (center): center is Center =>
      Boolean(center) && typeof center === 'object' && typeof (center as Center).id === 'string'
  );
}

export function CostCenterReviewSheet({
  rows,
  summary,
  drillQuery,
}: {
  rows: Record<string, unknown>[];
  summary?: unknown;
  drillQuery?: Record<string, string>;
}) {
  const centers = readCenters(summary);
  const accounts = rows as Row[];
  const totals = centers.map((center) =>
    accounts.reduce<{ debit: number; credit: number; balance: number }>(
      (sum, row) => {
        const cell = row.cells?.[center.id];
        return {
          debit: sum.debit + amount(cell?.debit),
          credit: sum.credit + amount(cell?.credit),
          balance: sum.balance + amount(cell?.balance),
        };
      },
      { debit: 0, credit: 0, balance: 0 }
    )
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div dir="rtl" className="report-scroll-viewport erp-scroll-x overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-sm" dir="rtl">
          <thead>
            <tr className="bg-[#0E4C6E] text-white">
              <th className="sticky right-0 z-20 w-10 border-e border-white/10 bg-[#0E4C6E] px-1 py-3 no-print">
                تحليل
              </th>
              <th className="sticky right-10 z-20 w-28 border-e border-white/10 bg-[#0E4C6E] px-3 py-3 text-right font-medium">
                رقم الحساب
              </th>
              <th className="sticky right-[9.5rem] z-20 min-w-52 border-e border-white/10 bg-[#0E4C6E] px-3 py-3 text-right font-medium">
                اسم الحساب
              </th>
              {centers.map((center) => (
                <th key={center.id} colSpan={3} className="border-e border-white/10 px-3 py-3 text-center font-medium">
                  <div>{center.name}</div>
                  {center.code ? <div className="mt-0.5 text-[11px] font-normal text-white/70">{center.code}</div> : null}
                </th>
              ))}
            </tr>
            <tr className="bg-[#1787B8] text-xs text-white">
              <th className="sticky right-0 z-20 border-e border-white/10 bg-[#1787B8] no-print" />
              <th className="sticky right-10 z-20 border-e border-white/10 bg-[#1787B8]" />
              <th className="sticky right-[9.5rem] z-20 border-e border-white/10 bg-[#1787B8]" />
              {centers.map((center) => (
                <FragmentHeaders key={center.id} />
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((row, index) => (
              <tr key={row.accountId ?? index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td
                  className={`sticky right-0 z-10 border-b border-e border-slate-100 px-1 py-2 text-center no-print ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                  }`}
                >
                  <BalanceRowEye
                    accountId={row.accountId}
                    label={[row.code, row.account].filter(Boolean).join(' — ')}
                    query={drillQuery}
                  />
                </td>
                <td
                  className={`sticky right-10 z-10 border-b border-e border-slate-100 px-3 py-2 tabular-nums text-slate-600 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                  }`}
                >
                  <AccountLedgerLink accountId={row.accountId} query={drillQuery} showIcon={false}>
                    {row.code}
                  </AccountLedgerLink>
                </td>
                <td
                  className={`sticky right-[9.5rem] z-10 border-b border-e border-slate-100 px-3 py-2 font-medium text-slate-800 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                  }`}
                >
                  <AccountLedgerLink accountId={row.accountId} query={drillQuery} showIcon={false}>
                    {row.account}
                  </AccountLedgerLink>
                </td>
                {centers.map((center) => {
                  const cell = row.cells?.[center.id];
                  const scoped = {
                    ...(drillQuery ?? {}),
                    costCenterId: center.id,
                  };
                  return (
                    <FragmentCells
                      key={center.id}
                      debit={amount(cell?.debit)}
                      credit={amount(cell?.credit)}
                      balance={amount(cell?.balance)}
                      accountId={row.accountId}
                      query={scoped}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#0E4C6E] font-semibold text-white">
              <td className="sticky right-0 z-10 bg-[#0E4C6E] px-3 py-3" colSpan={3}>
                المجموع
              </td>
              {totals.map((total, index) => (
                <FragmentCells
                  key={centers[index]?.id ?? index}
                  debit={total.debit}
                  credit={total.credit}
                  balance={total.balance}
                  footer
                />
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Figure({ value }: { value: number }) {
  if (!value) return <span className="text-slate-300">—</span>;
  return <span className="tabular-nums">{money(value)}</span>;
}

function FragmentHeaders() {
  return (
    <>
      <th className="px-2 py-1.5 font-normal">مدين</th>
      <th className="px-2 py-1.5 font-normal">دائن</th>
      <th className="border-e border-white/15 px-2 py-1.5 font-normal">رصيد</th>
    </>
  );
}

function FragmentCells({
  debit,
  credit,
  balance,
  footer = false,
  accountId,
  query,
}: {
  debit: number;
  credit: number;
  balance: number;
  footer?: boolean;
  accountId?: string;
  query?: Record<string, string>;
}) {
  const tone = footer ? 'text-white' : '';
  const figure = (value: number) => {
    if (footer) return money(value);
    if (!value) return <Figure value={value} />;
    return (
      <AccountLedgerLink accountId={accountId} query={query} showIcon={false}>
        {money(value)}
      </AccountLedgerLink>
    );
  };
  return (
    <>
      <td className={`border-b border-slate-100 px-2 py-2 text-center ${tone}`}>{figure(debit)}</td>
      <td className={`border-b border-slate-100 px-2 py-2 text-center ${tone}`}>{figure(credit)}</td>
      <td className={`border-b border-e border-slate-100 px-2 py-2 text-center font-medium ${tone}`}>
        {figure(balance)}
      </td>
    </>
  );
}
