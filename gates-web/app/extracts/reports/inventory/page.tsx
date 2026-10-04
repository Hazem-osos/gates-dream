'use client';

import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';

import { useState } from 'react';
import { InlineReportResults } from '@/components/report/InlineReportResults';
import { ExtractsReportChrome } from '@/components/extracts/ExtractsReportChrome';
import { ReportFilterDate } from '@/components/report/reportFilterFields';

const defaultFilters = () => ({
  ...reportDefaultDateRange(),
});

export default function InventoryPage() {
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(defaultFilters);

  const patch = (p: Partial<ReturnType<typeof defaultFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const handlePreview = () => {
    if (!filters.fromDate || !filters.toDate) {
      setError('يرجى اختيار تاريخ البداية والنهاية');
      return;
    }
    const params = new URLSearchParams();
    params.append('fromDate', filters.fromDate);
    params.append('toDate', filters.toDate);
    setPreviewQuery(Object.fromEntries(params));
  };

  return (
    <ExtractsReportChrome
      title="تقرير مخزون المستخلصات"
      onPreview={handlePreview}
      onReset={() => { setFilters(defaultFilters()); setPreviewQuery(null); }}
      error={error}
      onClearError={() => setError('')}
      below={previewQuery ? <InlineReportResults urlPath="/extracts/reports/inventory" query={previewQuery} /> : null}
    >
      <ReportFilterDate
        label="من تاريخ"
        value={filters.fromDate}
        onChange={(fromDate) => patch({ fromDate })}
      />
      <ReportFilterDate
        label="إلى تاريخ"
        value={filters.toDate}
        onChange={(toDate) => patch({ toDate })}
      />
    </ExtractsReportChrome>
  );
}
