'use client';

import { flattenSummaryEntries } from '@/lib/reportPreview/reportSummaryLabels';

const SUMMARY_ICONS: Record<string, string> = {
  totalInvoices: '🧾',
  totalQuantity: '📦',
  totalSales: '💰',
  totalPurchases: '💰',
  netSales: '💰',
  totalProfit: '📈',
  totalAmount: '💰',
};

function suffixForKey(key: string, value: string): string {
  if (key === 'totalInvoices' && value !== '—') return ` ${Number(value.replace(/,/g, '')) === 1 ? 'فاتورة' : 'فاتورة'}`;
  if (key === 'totalQuantity' && value !== '—') return ' قطعة';
  if (/sales|amount|profit|purchase|net/i.test(key) && value !== '—' && !value.includes('ج.م')) {
    return ' ج.م';
  }
  return '';
}

export function ReportMetricCards({ summary }: { summary: unknown }) {
  const entries = flattenSummaryEntries(summary);
  if (!entries.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
      {entries.map(({ key, label, value }) => {
        const icon = SUMMARY_ICONS[key] ?? '📊';
        const display = `${value}${suffixForKey(key, value)}`;
        return (
          <div
            key={key}
            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 px-4 py-3 text-right shadow-sm"
          >
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1 justify-end">
              <span>{label}</span>
              <span aria-hidden>{icon}</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {display}
            </div>
          </div>
        );
      })}
    </div>
  );
}
