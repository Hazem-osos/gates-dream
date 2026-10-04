'use client';

import { flattenSummaryEntries } from '@/lib/reportPreview/reportSummaryLabels';

function suffixForKey(key: string, value: string, currencyLabel: string): string {
  if (key === 'currencyCode') return '';
  if (/^(base|foreign)(Debit|Credit|Balance)$/.test(key)) return '';
  if (/count|invoices|quantity|items|customers|suppliers|pages/i.test(key)) {
    if (key === 'totalQuantity' && value !== '—') return ' قطعة';
    return '';
  }
  if (/sales|amount|profit|purchase|net|balance|collection|value/i.test(key) && value !== '—' && !value.includes(currencyLabel)) {
    return ` ${currencyLabel}`;
  }
  return '';
}

export function ReportMetricCards({ summary, currencyLabel = 'ج.م' }: { summary: unknown; currencyLabel?: string }) {
  const entries = flattenSummaryEntries(summary);
  if (!entries.length) return null;

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {entries.map(({ key, label, value }) => {
        const display = `${value}${suffixForKey(key, value, currencyLabel)}`;
        const net = key === 'netValue' || key === 'netSales' || key === 'netAmount';
        return (
          <div
            key={key}
            className={`rounded-lg border px-3 py-2 text-right ${
              net
                ? 'border-[#B7D7E8] bg-[#F4FAFC] dark:border-sky-900 dark:bg-sky-950/30'
                : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <div className="text-[11px] font-medium leading-4 text-slate-500 dark:text-slate-400">{label}</div>
            <div className={`mt-0.5 text-sm font-semibold tabular-nums leading-5 ${net ? 'text-[#0E4C6E] dark:text-sky-100' : 'text-slate-800 dark:text-slate-100'}`}>
              {display}
            </div>
          </div>
        );
      })}
    </div>
  );
}
