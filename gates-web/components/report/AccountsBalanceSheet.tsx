'use client';

import { useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import {
  comparisonQuery,
  stripCompareParam,
  type FiscalYearOption,
} from '@/lib/reports/compareFiscalYear';
import { buildLegalFinancialPosition } from '@/lib/reports/legalFinancialPosition';

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

type LineKind = 'header' | 'line' | 'total' | 'grand';

type StatementLine = {
  kind: LineKind;
  name: string;
  note?: number;
  current?: number;
  opening?: number;
};

type NoteBlock = {
  note: number;
  title: string;
  opening: number;
  current: number;
  rows: { name: string; opening: number; current: number }[];
};

function money(value: number | undefined, wrapped = false) {
  if (value == null || Number.isNaN(value)) return '';
  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value < 0) return wrapped ? `(${formatted}-)` : `${formatted}-`;
  return formatted;
}

function formatHeaderDate(iso: string) {
  const day = iso.slice(0, 10);
  const [year, month, date] = day.split('-');
  if (!year || !month || !date) return iso;
  return `${date}/${month}/${year}`;
}

function openingIso(asOf: string) {
  const year = Number(asOf.slice(0, 4));
  if (!Number.isFinite(year)) return asOf.slice(0, 10);
  return `${year}-01-01`;
}

function rowKey(row: SheetRow) {
  return `${row.code}|${row.arabicName}`;
}

const POSITION_BALANCE_HEADER = 'الأرصدة في تاريخ المركز المالي';
const COMPARISON_BALANCE_HEADER = 'الأرصدة في تاريخ المقارنة';

export function AccountsBalanceSheet({ query }: { query: Record<string, string> }) {
  const [showNotes, setShowNotes] = useState(false);
  const positionDate = (query.asOfDate || query.toDate || '').slice(0, 10);
  const comparisonDate = (query.fromDate || '').slice(0, 10);
  const { data: yearsRes } = useApiQuery<FiscalYearOption[]>(
    ['company-fiscal-years', 'report-compare'],
    '/company/fiscal-years',
    { page: 1, limit: 100 },
    { enabled: Boolean(positionDate) }
  );
  const years = yearsRes?.data ?? [];
  const compareYear = years.find((year) => year.id === query.compareFiscalYearId);
  const comparisonAsOf = compareYear
    ? compareYear.endDate.slice(0, 10)
    : comparisonDate || (positionDate ? openingIso(positionDate) : '');
  const showComparisonColumn = Boolean(comparisonAsOf) && comparisonAsOf !== positionDate;

  const currentParams = useMemo(() => {
    const next = stripCompareParam(query);
    if (positionDate) next.asOfDate = positionDate;
    return next;
  }, [positionDate, query]);

  const comparisonParams = useMemo(() => {
    if (compareYear) return comparisonQuery(query, compareYear);
    const next = stripCompareParam(query);
    if (comparisonAsOf) next.asOfDate = comparisonAsOf;
    delete next.toDate;
    delete next.fromDate;
    return next;
  }, [compareYear, comparisonAsOf, query]);

  const current = useApiQuery<BalanceSheetPayload>(
    ['balance-sheet-statement', 'current', JSON.stringify(currentParams)],
    '/accounting/reports/balance-sheet',
    currentParams,
    { enabled: Boolean(positionDate) }
  );
  const prior = useApiQuery<BalanceSheetPayload>(
    ['balance-sheet-statement', 'comparison', JSON.stringify(comparisonParams)],
    '/accounting/reports/balance-sheet',
    comparisonParams,
    { enabled: Boolean(comparisonAsOf) && comparisonAsOf !== positionDate }
  );

  const payload = current.data?.data;
  const priorSheet = prior.data?.data?.sheet;
  const openingByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of [...(priorSheet?.assets ?? []), ...(priorSheet?.liabilities ?? [])]) {
      map.set(rowKey(row), row.amount);
    }
    return map;
  }, [priorSheet]);

  const assets = payload?.sheet?.assets ?? [];
  const liabilities = payload?.sheet?.liabilities ?? [];

  const { lines, notes } = useMemo(
    () =>
      buildLegalFinancialPosition(assets, liabilities, (row) => openingByKey.get(rowKey(row)) ?? 0),
    [assets, liabilities, openingByKey]
  );

  if (!positionDate) {
    return <p className="py-6 text-center text-sm text-slate-500">حدد تاريخ المركز المالي ثم اعرض التقرير.</p>;
  }
  if (current.isLoading) {
    return <p className="py-6 text-center text-sm text-slate-500">جاري تجهيز المركز المالي…</p>;
  }
  if (current.isError) {
    return (
      <p className="py-6 text-center text-sm text-red-600">{current.error?.message || 'تعذر تحميل المركز المالي'}</p>
    );
  }
  if (!assets.length && !liabilities.length) {
    return <p className="py-6 text-center text-sm text-slate-500">لا توجد أرصدة في هذا التاريخ.</p>;
  }

  const positionColumnLabel = `${POSITION_BALANCE_HEADER} (${formatHeaderDate(positionDate)})`;
  const comparisonColumnLabel = showComparisonColumn
    ? `${COMPARISON_BALANCE_HEADER} (${formatHeaderDate(comparisonAsOf)})`
    : COMPARISON_BALANCE_HEADER;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-right">
          <h2 className="text-base font-bold text-[#0A3D5E]">
            المركز المالي في {formatHeaderDate(positionDate)}
          </h2>
          <p className="mt-1 text-xs text-slate-500">العملة جنيه مصري</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNotes((open) => !open)}
          className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
            showNotes ? 'bg-[#0E78AA] text-white' : 'border border-[#0E78AA] bg-white text-[#0E78AA]'
          }`}
        >
          قائمة الإيضاحات
        </button>
      </div>

      {showNotes ? (
        <NotesView
          notes={notes}
          positionLabel={positionColumnLabel}
          comparisonLabel={comparisonColumnLabel}
          showComparison={showComparisonColumn}
        />
      ) : (
        <StatementTable
          lines={lines}
          positionLabel={positionColumnLabel}
          comparisonLabel={comparisonColumnLabel}
          showComparison={showComparisonColumn}
        />
      )}
    </div>
  );
}

function StatementTable({
  lines,
  positionLabel,
  comparisonLabel,
  showComparison,
}: {
  lines: StatementLine[];
  positionLabel: string;
  comparisonLabel: string;
  showComparison: boolean;
}) {
  const colSpan = showComparison ? 4 : 3;
  return (
    <div dir="rtl" className="report-scroll-viewport erp-scroll-x overflow-x-auto rounded-xl border border-[#D6EAF3] bg-white">
      <table className="w-full min-w-[720px] border-collapse text-sm text-[#0A3D5E]">
        <thead>
          <tr className="bg-[#F3F4F6] text-[#0A3D5E]">
            <th className="px-4 py-2.5 text-right font-semibold">البيان</th>
            <th className="w-28 px-3 py-2.5 text-center font-semibold">رقم الإيضاح</th>
            <th className="w-44 px-3 py-2.5 text-center font-semibold">{positionLabel}</th>
            {showComparison ? (
              <th className="w-44 px-3 py-2.5 text-center font-semibold">{comparisonLabel}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            if (line.kind === 'header') {
              return (
                <tr key={`${line.kind}-${line.name}-${index}`}>
                  <td className="px-4 py-2 text-right font-bold text-red-700" colSpan={colSpan}>
                    {line.name}
                  </td>
                </tr>
              );
            }
            const total = line.kind === 'total' || line.kind === 'grand';
            return (
              <tr key={`${line.kind}-${line.name}-${index}`} className={total ? 'bg-[#F3F4F6] font-bold' : undefined}>
                <td className={`px-4 py-1.5 text-right ${total ? 'text-red-700' : ''}`}>{line.name}</td>
                <td className="px-3 py-1.5 text-center">{line.note ?? ''}</td>
                <td className="px-3 py-1.5 text-center tabular-nums">{money(line.current)}</td>
                {showComparison ? (
                  <td className="px-3 py-1.5 text-center tabular-nums">{money(line.opening)}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NotesView({
  notes,
  positionLabel,
  comparisonLabel,
  showComparison,
}: {
  notes: NoteBlock[];
  positionLabel: string;
  comparisonLabel: string;
  showComparison: boolean;
}) {
  return (
    <div className="space-y-10 rounded-xl border border-[#D6EAF3] bg-white px-6 py-8">
      {notes.map((block) => (
        <section key={block.note} className="space-y-2">
          <h3 className="text-right text-sm font-bold text-[#0A3D5E]">
            إيضاح {block.note} {block.title}
          </h3>
          <p className="text-right text-xs leading-6 text-slate-600">
            بلغ رصيد {block.title} {positionLabel} مبلغ {money(block.current)}
            {showComparison ? ` و${comparisonLabel} مبلغ ${money(block.opening)}` : ''}
          </p>
          <table className="mr-0 ml-auto w-full max-w-xl border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-slate-400 px-3 py-1 text-right font-semibold">البيان</th>
                <th className="w-36 border-b border-slate-400 px-3 py-1 text-center font-semibold">{positionLabel}</th>
                {showComparison ? (
                  <th className="w-36 border-b border-slate-400 px-3 py-1 text-center font-semibold">
                    {comparisonLabel}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.name}>
                  <td className="px-3 py-1 text-right">{row.name}</td>
                  <td className="px-3 py-1 text-center tabular-nums">{money(row.current, true)}</td>
                  {showComparison ? (
                    <td className="px-3 py-1 text-center tabular-nums">{money(row.opening, true)}</td>
                  ) : null}
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border-t-2 border-double border-slate-700 px-3 py-1.5 text-right">الإجمالي</td>
                <td className="border-t-2 border-double border-slate-700 px-3 py-1.5 text-center tabular-nums">
                  {money(block.current, true)}
                </td>
                {showComparison ? (
                  <td className="border-t-2 border-double border-slate-700 px-3 py-1.5 text-center tabular-nums">
                    {money(block.opening, true)}
                  </td>
                ) : null}
              </tr>
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
