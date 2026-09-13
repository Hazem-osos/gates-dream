'use client';

import { flattenSummaryEntries } from '@/lib/reportPreview/reportSummaryLabels';

export function ReportSummaryPanel({ summary }: { summary: unknown }) {
  const entries = flattenSummaryEntries(summary);
  if (!entries.length) return null;

  return (
    <div className="mb-6 rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-[#0E78AA] mb-3 text-right">ملخص التقرير</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map(({ key, label, value }) => (
          <div
            key={key}
            className="rounded-lg bg-[#F6FBFD] border border-[#E6F0F7] px-4 py-3 text-right"
          >
            <div className="text-xs text-[#5a7a8a] mb-1">{label}</div>
            <div className="text-base font-semibold text-[#094C6B] tabular-nums">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
