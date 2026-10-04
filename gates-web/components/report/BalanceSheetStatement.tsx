'use client';

import { useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import {
  comparisonQuery,
  fiscalYearLabel,
  periodYearLabel,
  stripCompareParam,
  type FiscalYearOption,
} from '@/lib/reports/compareFiscalYear';

type SheetRow = {
  code: string;
  arabicName: string;
  amount: number;
  depth: number;
};

type BalanceSheetPayload = {
  asOfDate?: string;
  sheet?: { assets: SheetRow[]; liabilities: SheetRow[] };
  summary?: {
    totalAssets?: number;
    totalLiabilities?: number;
    totalEquity?: number;
  };
};

function money(value: number | undefined) {
  if (value == null || Number.isNaN(value) || value === 0) return '';
  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `(${formatted})` : formatted;
}

function rowKey(row: SheetRow) {
  return `${row.code}|${row.arabicName}`;
}

function padRows(left: SheetRow[], right: SheetRow[]) {
  const length = Math.max(left.length, right.length);
  return Array.from({ length }, (_, index) => ({
    asset: left[index],
    liability: right[index],
  }));
}

export function BalanceSheetStatement({ query }: { query: Record<string, string> }) {
  const [view, setView] = useState<'list' | 't'>('list');
  const asOf = query.asOfDate || query.toDate || '';
  const { data: yearsRes } = useApiQuery<FiscalYearOption[]>(
    ['company-fiscal-years', 'report-compare'],
    '/company/fiscal-years',
    { page: 1, limit: 100 },
    { enabled: Boolean(asOf) }
  );
  const years = yearsRes?.data ?? [];
  const compareYear = years.find((year) => year.id === query.compareFiscalYearId);
  const currentYearLabel = periodYearLabel(years, query.fromDate, asOf) || asOf.slice(0, 4);
  const compareYearLabel = compareYear ? fiscalYearLabel(compareYear) : '';

  const currentParams = useMemo(() => {
    const next = stripCompareParam(query);
    if (asOf) next.asOfDate = asOf;
    return next;
  }, [asOf, query]);

  const openingParams = useMemo(() => {
    if (!compareYear) return null;
    return comparisonQuery(query, compareYear);
  }, [compareYear, query]);

  const current = useApiQuery<BalanceSheetPayload>(
    ['balance-sheet-statement', 'current', JSON.stringify(currentParams)],
    '/accounting/reports/balance-sheet',
    currentParams,
    { enabled: Boolean(asOf) }
  );
  const prior = useApiQuery<BalanceSheetPayload>(
    ['balance-sheet-statement', 'opening', JSON.stringify(openingParams)],
    '/accounting/reports/balance-sheet',
    openingParams ?? {},
    { enabled: Boolean(openingParams) }
  );

  const payload = current.data?.data;
  const priorSheet = prior.data?.data?.sheet;
  const priorByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of [...(priorSheet?.assets ?? []), ...(priorSheet?.liabilities ?? [])]) {
      map.set(rowKey(row), row.amount);
    }
    return map;
  }, [priorSheet]);

  const assets = payload?.sheet?.assets ?? [];
  const liabilities = payload?.sheet?.liabilities ?? [];
  const totalAssets = Number(payload?.summary?.totalAssets ?? 0);
  const totalLiabilitiesAndEquity =
    Number(payload?.summary?.totalLiabilities ?? 0) + Number(payload?.summary?.totalEquity ?? 0);

  if (!asOf) {
    return <p className="py-6 text-center text-sm text-slate-500">حدد تاريخ الميزانية ثم اعرض التقرير.</p>;
  }
  if (current.isLoading) {
    return <p className="py-6 text-center text-sm text-slate-500">جاري تجهيز الميزانية…</p>;
  }
  if (current.isError) {
    return <p className="py-6 text-center text-sm text-red-600">{current.error?.message || 'تعذر تحميل الميزانية'}</p>;
  }
  if (!assets.length && !liabilities.length) {
    return <p className="py-6 text-center text-sm text-slate-500">لا توجد أرصدة في هذا التاريخ.</p>;
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">العملة جنيه مصري</p>
        <div className="flex overflow-hidden rounded-lg border border-[#0E78AA]">
          <ViewButton active={view === 'list'} onClick={() => setView('list')}>
            قائمة
          </ViewButton>
          <ViewButton active={view === 't'} onClick={() => setView('t')}>
            حرف T
          </ViewButton>
        </div>
      </div>
      {view === 'list' ? (
        <ListView
          assets={assets}
          liabilities={liabilities}
          totalAssets={totalAssets}
          totalLiabilitiesAndEquity={totalLiabilitiesAndEquity}
        />
      ) : (
        <TView
          assets={assets}
          liabilities={liabilities}
          priorByKey={priorByKey}
          currentYearLabel={currentYearLabel}
          compareYearLabel={compareYearLabel}
          totalAssets={totalAssets}
          totalLiabilitiesAndEquity={totalLiabilitiesAndEquity}
        />
      )}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 text-sm font-semibold ${active ? 'bg-[#0E78AA] text-white' : 'bg-white text-[#0E78AA]'}`}
    >
      {children}
    </button>
  );
}

function ListView({
  assets,
  liabilities,
  totalAssets,
  totalLiabilitiesAndEquity,
}: {
  assets: SheetRow[];
  liabilities: SheetRow[];
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
}) {
  const pairs = padRows(assets, liabilities);
  return (
    <div className="overflow-x-auto rounded-xl border border-[#D6E4EE] bg-white">
      <table className="w-full min-w-[880px] border-collapse text-sm text-[#16324F]">
        <thead>
          <tr className="bg-[#1B6CA8] text-white">
            <th className="px-3 py-2 text-center font-semibold" colSpan={2}>
              الأصول
            </th>
            <th className="border-s border-white/30 px-3 py-2 text-center font-semibold" colSpan={2}>
              الالتزامات وحقوق الملكية
            </th>
          </tr>
          <tr className="bg-[#E8F3FB] text-[#16324F]">
            <th className="px-3 py-1.5 text-right font-semibold">الحساب</th>
            <th className="w-36 px-3 py-1.5 text-center font-semibold">المبلغ</th>
            <th className="border-s border-[#1B6CA8]/20 px-3 py-1.5 text-right font-semibold">الحساب</th>
            <th className="w-36 px-3 py-1.5 text-center font-semibold">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair, index) => (
            <tr key={index} className="border-t border-slate-100 odd:bg-slate-50/60">
              <AccountCell row={pair.asset} />
              <AmountCell value={pair.asset?.amount} />
              <AccountCell row={pair.liability} split />
              <AmountCell value={pair.liability?.amount} />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[#D6EAF8] font-semibold">
            <td className="px-3 py-2 text-right">المجموع</td>
            <td className="px-3 py-2 text-center tabular-nums">{money(totalAssets)}</td>
            <td className="border-s border-[#1B6CA8]/20 px-3 py-2 text-right">المجموع</td>
            <td className="px-3 py-2 text-center tabular-nums">{money(totalLiabilitiesAndEquity)}</td>
          </tr>
          <tr className="bg-[#1B6CA8] font-bold text-white">
            <td className="px-3 py-2 text-right">المجموع العام</td>
            <td className="px-3 py-2 text-center tabular-nums">{money(totalAssets)}</td>
            <td className="border-s border-white/30 px-3 py-2 text-right">المجموع العام</td>
            <td className="px-3 py-2 text-center tabular-nums">{money(totalLiabilitiesAndEquity)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function AccountCell({ row, split = false }: { row?: SheetRow; split?: boolean }) {
  if (!row) return <td className={split ? 'border-s border-slate-200' : undefined} />;
  const label = [row.code, row.arabicName].filter(Boolean).join(' ');
  return (
    <td className={`px-3 py-1.5 text-right ${split ? 'border-s border-slate-200' : ''}`} style={{ paddingInlineStart: 12 + row.depth * 16 }}>
      <span className={row.depth === 0 ? 'font-semibold' : ''}>{label}</span>
    </td>
  );
}

function AmountCell({ value }: { value?: number }) {
  return <td className="px-3 py-1.5 text-center tabular-nums">{money(value)}</td>;
}

function TView({
  assets,
  liabilities,
  priorByKey,
  currentYearLabel,
  compareYearLabel,
  totalAssets,
  totalLiabilitiesAndEquity,
}: {
  assets: SheetRow[];
  liabilities: SheetRow[];
  priorByKey: Map<string, number>;
  currentYearLabel: string;
  compareYearLabel: string;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
}) {
  return (
    <div className="grid overflow-hidden rounded-xl border border-[#D6E4EE] bg-white lg:grid-cols-2">
      <TSide
        title="الأصول"
        rows={assets}
        priorByKey={priorByKey}
        currentYearLabel={currentYearLabel}
        compareYearLabel={compareYearLabel}
        total={totalAssets}
        edge="right"
      />
      <TSide
        title="الالتزامات وحقوق الملكية"
        rows={liabilities}
        priorByKey={priorByKey}
        currentYearLabel={currentYearLabel}
        compareYearLabel={compareYearLabel}
        total={totalLiabilitiesAndEquity}
        edge="left"
      />
    </div>
  );
}

function TSide({
  title,
  rows,
  priorByKey,
  currentYearLabel,
  compareYearLabel,
  total,
  edge,
}: {
  title: string;
  rows: SheetRow[];
  priorByKey: Map<string, number>;
  currentYearLabel: string;
  compareYearLabel: string;
  total: number;
  edge: 'right' | 'left';
}) {
  const split = edge === 'left';
  return (
    <section className={split ? 'border-s-4 border-[#1B6CA8]' : undefined}>
      <header className="bg-[#F4F7FB] px-4 py-2 text-center text-sm font-bold text-[#9B2335]">{title}</header>
      <div className={`grid gap-2 px-3 py-2 text-center text-xs font-semibold text-slate-500 ${compareYearLabel ? 'grid-cols-[1fr_7rem_7rem]' : 'grid-cols-[1fr_7rem]'}`}>
        <span />
        <span>{currentYearLabel}</span>
        {compareYearLabel ? <span>{compareYearLabel}</span> : null}
      </div>
      <div>
        {rows.map((row) => {
          const prior = priorByKey.get(rowKey(row));
          const group = row.depth === 0;
          return (
            <div
              key={rowKey(row)}
              className={`grid items-center gap-2 border-t border-slate-100 px-3 py-1 ${compareYearLabel ? 'grid-cols-[1fr_7rem_7rem]' : 'grid-cols-[1fr_7rem]'}`}
            >
              <div className="text-right text-[#9B2335]" style={{ paddingInlineStart: row.depth * 14 }}>
                <span className={group ? 'font-bold' : 'text-[13px]'}>{row.arabicName}</span>
              </div>
              <Figure value={row.amount} boxed={group} />
              {compareYearLabel ? <Figure value={prior} boxed={group} /> : null}
            </div>
          );
        })}
      </div>
      <div className={`grid items-center gap-2 border-t-2 border-[#1B6CA8] bg-[#F4F7FB] px-3 py-2 font-bold ${compareYearLabel ? 'grid-cols-[1fr_7rem_7rem]' : 'grid-cols-[1fr_7rem]'}`}>
        <div className="text-right text-[#9B2335]">المجموع</div>
        <Figure value={total} boxed />
        {compareYearLabel ? <span /> : null}
      </div>
    </section>
  );
}

function Figure({ value, boxed }: { value?: number; boxed?: boolean }) {
  const text = money(value);
  if (!text) return <span />;
  return (
    <span className={`text-center text-sm tabular-nums text-[#16324F] ${boxed ? 'rounded border border-slate-400 px-1 py-0.5' : ''}`}>
      {text}
    </span>
  );
}
