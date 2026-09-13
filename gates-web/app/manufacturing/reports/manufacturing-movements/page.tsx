'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ManufacturingReportChrome } from '@/components/manufacturing/ManufacturingReportChrome';
import {
  ReportFilterCheckbox,
  ReportFilterCostCenterSelect,
  ReportFilterDate,
  ReportFilterSection,
  ReportFilterSelect,
} from '@/components/report/reportFilterFields';
import { useApiQuery } from '@/lib/hooks/useApi';

const defaultFilters = () => ({
  fromDate: new Date().toISOString().split('T')[0],
  toDate: new Date().toISOString().split('T')[0],
  currencyId: '',
  costCenterId: '',
});

export default function ManufacturingMovementsPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [showUnposted, setShowUnposted] = useState(true);
  const [filters, setFilters] = useState(defaultFilters);
  const patch = (p: Partial<ReturnType<typeof defaultFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const { data: currenciesResponse } = useApiQuery<{ id: string; code: string; arabicName: string }[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencyOptions = (currenciesResponse?.data ?? []).map((c) => ({
    value: c.id,
    label: `${c.arabicName} (${c.code})`,
  }));

  const handlePreview = () => {
    if (!filters.fromDate || !filters.toDate) {
      setError('يرجى اختيار تاريخ البداية والنهاية');
      return;
    }
    const params = new URLSearchParams();
    params.append('fromDate', filters.fromDate);
    params.append('toDate', filters.toDate);
    if (filters.currencyId) params.append('currencyId', filters.currencyId);
    if (filters.costCenterId) params.append('costCenterId', filters.costCenterId);
    if (showUnposted) params.append('showUnposted', 'true');
    router.push(`/manufacturing/reports/manufacturing-movements/preview?${params.toString()}`);
  };

  return (
    <ManufacturingReportChrome
      title="حركات التصنيع"
      onPreview={handlePreview}
      onReset={() => {
        setFilters(defaultFilters());
        setShowUnposted(true);
      }}
      error={error}
      onClearError={() => setError('')}
    >
      <ReportFilterSection title="التواريخ">
        <ReportFilterDate label="من تاريخ" value={filters.fromDate} onChange={(fromDate) => patch({ fromDate })} />
        <ReportFilterDate label="إلى تاريخ" value={filters.toDate} onChange={(toDate) => patch({ toDate })} />
      </ReportFilterSection>
      <ReportFilterSection title="المرشحات">
        <ReportFilterCostCenterSelect
          label="مركز التكلفة"
          value={filters.costCenterId}
          onChange={(costCenterId) => patch({ costCenterId })}
        />
        <ReportFilterSelect
          label="العملة"
          value={filters.currencyId}
          onChange={(currencyId) => patch({ currencyId })}
          options={currencyOptions}
          placeholder="كل العملات"
        />
      </ReportFilterSection>
      <ReportFilterCheckbox
        id="showUnposted-mov"
        label="إظهار العمليات غير المرحّلة"
        checked={showUnposted}
        onChange={setShowUnposted}
      />
    </ManufacturingReportChrome>
  );
}
