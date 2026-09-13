'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExtractsReportChrome } from '@/components/extracts/ExtractsReportChrome';
import { ReportFilterDate } from '@/components/report/reportFilterFields';

const defaultFilters = () => ({
  fromDate: new Date().toISOString().split('T')[0],
  toDate: new Date().toISOString().split('T')[0],
});

export default function ContractorPaymentsPage() {
  const router = useRouter();
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
    router.push(`/extracts/reports/contractor-payments/preview?${params.toString()}`);
  };

  return (
    <ExtractsReportChrome
      title="تقرير سداد المقاولين"
      onPreview={handlePreview}
      onReset={() => setFilters(defaultFilters())}
      error={error}
      onClearError={() => setError('')}
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
