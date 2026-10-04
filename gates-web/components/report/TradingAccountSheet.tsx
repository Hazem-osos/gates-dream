'use client';

import { useMemo } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { printDom } from '@/lib/print/printHtml';
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
  compareAmount?: number;
  depth: number;
};

type TradingSummary = {
  totalDebit?: number;
  totalCredit?: number;
  grossProfit?: number;
  grandTotal?: number;
  sheet?: { debit: SheetRow[]; credit: SheetRow[] };
};

function money(value: number | undefined) {
  if (value == null || Number.isNaN(value) || value === 0) return '';
  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `(${formatted})` : formatted;
}

function accountLabel(row: SheetRow) {
  return [row.code, row.arabicName].filter(Boolean).join(' ');
}

function withCompare(rows: SheetRow[], compareRows: SheetRow[]): SheetRow[] {
  const byCode = new Map(compareRows.map((row) => [row.code, row.amount]));
  return rows.map((row) => ({ ...row, compareAmount: byCode.get(row.code) ?? 0 }));
}

export function TradingAccountSheet({ query }: { query: Record<string, string> }) {
  const ready = Boolean(query.fromDate && query.toDate);
  const currentQuery = stripCompareParam(query);
  const report = useApiQuery<unknown>(
    ['trading-account', JSON.stringify(currentQuery)],
    '/accounting/reports/trading-account',
    currentQuery,
    { enabled: ready }
  );
  const { data: yearsRes } = useApiQuery<FiscalYearOption[]>(
    ['company-fiscal-years', 'report-compare'],
    '/company/fiscal-years',
    { page: 1, limit: 100 },
    { enabled: ready }
  );
  const years = yearsRes?.data ?? [];
  const compareYear = years.find((year) => year.id === query.compareFiscalYearId);
  const compareParams = compareYear ? comparisonQuery(query, compareYear) : undefined;
  const compareReport = useApiQuery<unknown>(
    ['trading-account-compare', compareParams ? JSON.stringify(compareParams) : ''],
    '/accounting/reports/trading-account',
    compareParams,
    { enabled: Boolean(compareParams) }
  );
  const currentYearLabel = periodYearLabel(years, query.fromDate, query.toDate);
  const compareYearLabel = compareYear ? fiscalYearLabel(compareYear) : '';

  const summary = (report.data as { summary?: TradingSummary } | undefined)?.summary;
  const compareSummary = (compareReport.data as { summary?: TradingSummary } | undefined)?.summary;
  const debit = withCompare(summary?.sheet?.debit ?? [], compareSummary?.sheet?.debit ?? []);
  const credit = withCompare(summary?.sheet?.credit ?? [], compareSummary?.sheet?.credit ?? []);
  const totalDebit = Number(summary?.totalDebit ?? 0);
  const totalCredit = Number(summary?.totalCredit ?? 0);
  const grossProfit = Number(summary?.grossProfit ?? 0);
  const grandTotal = Number(summary?.grandTotal ?? Math.max(totalDebit, totalCredit));
  const profitOnDebit = grossProfit > 0;
  const lossOnCredit = grossProfit < 0;

  const length = Math.max(debit.length, credit.length, 1);
  const pairs = useMemo(
    () =>
      Array.from({ length }, (_, index) => ({
        debit: debit[index],
        credit: credit[index],
      })),
    [credit, debit, length]
  );

  if (!ready) {
    return <p className="py-6 text-center text-sm text-slate-500">حدد فترة التقرير ثم اعرض.</p>;
  }
  if (report.isLoading) {
    return <p className="py-6 text-center text-sm text-slate-500">جاري تجهيز حساب المتاجرة…</p>;
  }
  if (report.isError) {
    return <p className="py-6 text-center text-sm text-red-600">تعذّر تحميل حساب المتاجرة.</p>;
  }
  if (!debit.length && !credit.length) {
    return <p className="py-6 text-center text-sm text-slate-500">لا توجد حركة متاجرة في هذه الفترة.</p>;
  }

  const cell = 'border border-slate-400 px-2 py-1';
  const amountCell = `${cell} text-center tabular-nums text-slate-900`;
  const nameCell = `${cell} text-right text-slate-900`;

  return (
    <div>
      <div className="mb-2 flex justify-start no-print">
        <button
          type="button"
          onClick={() => {
            const root = document.getElementById('trading-account-print');
            if (root) void printDom(root, 'حساب المتاجرة');
          }}
          className="inline-flex h-8 items-center rounded-lg bg-[#0E78AA] px-3 text-xs font-semibold text-white"
        >
          طباعة
        </button>
      </div>
      <div id="trading-account-print" className="overflow-x-auto" dir="rtl">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1d6fb8] text-white">
              {compareYearLabel ? (
                <th className={`${cell} w-36 border-white/40`}>{compareYearLabel}</th>
              ) : null}
              <th className={`${cell} w-36 border-white/40`}>{currentYearLabel}</th>
              <th className={`${cell} border-white/40`}>الحساب</th>
              {compareYearLabel ? (
                <th className={`${cell} w-36 border-white/40`}>{compareYearLabel}</th>
              ) : null}
              <th className={`${cell} w-36 border-white/40`}>{currentYearLabel}</th>
              <th className={`${cell} border-white/40`}>الحساب</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair, index) => (
              <tr key={index}>
                {compareYearLabel ? (
                  <td className={amountCell}>{pair.debit ? money(pair.debit.compareAmount) : ''}</td>
                ) : null}
                <td className={amountCell}>{pair.debit ? money(pair.debit.amount) : ''}</td>
                <td className={nameCell} style={{ paddingRight: pair.debit ? 8 + pair.debit.depth * 14 : undefined }}>
                  <span className={pair.debit?.depth === 0 ? 'font-semibold' : undefined}>
                    {pair.debit ? accountLabel(pair.debit) : ''}
                  </span>
                </td>
                {compareYearLabel ? (
                  <td className={amountCell}>{pair.credit ? money(pair.credit.compareAmount) : ''}</td>
                ) : null}
                <td className={amountCell}>{pair.credit ? money(pair.credit.amount) : ''}</td>
                <td className={nameCell} style={{ paddingRight: pair.credit ? 8 + pair.credit.depth * 14 : undefined }}>
                  <span className={pair.credit?.depth === 0 ? 'font-semibold' : undefined}>
                    {pair.credit ? accountLabel(pair.credit) : ''}
                  </span>
                </td>
              </tr>
            ))}
            <tr className="bg-[#e7f1fa] font-semibold">
              {compareYearLabel ? <td className={amountCell}>{money(Number(compareSummary?.totalDebit ?? 0))}</td> : null}
              <td className={amountCell}>{money(totalDebit)}</td>
              <td className={nameCell}>المجموع</td>
              {compareYearLabel ? <td className={amountCell}>{money(Number(compareSummary?.totalCredit ?? 0))}</td> : null}
              <td className={amountCell}>{money(totalCredit)}</td>
              <td className={nameCell}>المجموع</td>
            </tr>
            <tr>
              {compareYearLabel ? <td className={amountCell} /> : null}
              <td className={amountCell}>{profitOnDebit ? money(grossProfit) : ''}</td>
              <td className={`${nameCell} font-semibold text-red-700`}>{profitOnDebit ? 'معدل ربح' : ''}</td>
              {compareYearLabel ? <td className={amountCell} /> : null}
              <td className={amountCell}>{lossOnCredit ? money(Math.abs(grossProfit)) : ''}</td>
              <td className={`${nameCell} font-semibold text-red-700`}>{lossOnCredit ? 'معدل خسارة' : ''}</td>
            </tr>
            <tr className="bg-[#d6e8f6] font-bold">
              {compareYearLabel ? <td className={amountCell}>{money(Number(compareSummary?.grandTotal ?? 0))}</td> : null}
              <td className={amountCell}>{money(grandTotal)}</td>
              <td className={nameCell}>المجموع العام</td>
              {compareYearLabel ? <td className={amountCell}>{money(Number(compareSummary?.grandTotal ?? 0))}</td> : null}
              <td className={amountCell}>{money(grandTotal)}</td>
              <td className={nameCell}>المجموع العام</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
