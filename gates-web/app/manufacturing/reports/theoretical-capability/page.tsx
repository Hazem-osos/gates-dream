'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ManufacturingReportChrome } from '@/components/manufacturing/ManufacturingReportChrome';
import { ReportFilterDate, ReportFilterSection } from '@/components/report/reportFilterFields';

const defaultFilters = () => ({
  fromDate: new Date().toISOString().split('T')[0],
  toDate: new Date().toISOString().split('T')[0],
});

export default function TheoreticalCapabilityPage() {
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
    router.push(`/manufacturing/reports/theoretical-capability/preview?${params.toString()}`);
  };

  return (
    <ManufacturingReportChrome
      title="القدرة النظرية"
      onPreview={handlePreview}
      onReset={() => setFilters(defaultFilters())}
      error={error}
      onClearError={() => setError('')}
    >
      <ReportFilterSection title="التواريخ">
        <ReportFilterDate label="من تاريخ" value={filters.fromDate} onChange={(fromDate) => patch({ fromDate })} />
        <ReportFilterDate label="إلى تاريخ" value={filters.toDate} onChange={(toDate) => patch({ toDate })} />
      </ReportFilterSection>
    </ManufacturingReportChrome>
  );
}
