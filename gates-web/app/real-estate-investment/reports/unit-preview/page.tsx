'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';
import {
  ReportFilterDate,
  ReportFilterPartySelect,
  ReportFilterSection,
} from '@/components/report/reportFilterFields';


const defaultFilters = () => ({
  fromDate: new Date().toISOString().split('T')[0],
  toDate: new Date().toISOString().split('T')[0],
  customerId: '',
});

export default function UnitPreviewPage() {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
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
    if (filters.customerId) params.append('customerId', filters.customerId);
    router.push(`/real-estate-investment/reports/unit-preview/preview?${params.toString()}`);
  };

  return (
    <CatalogReportFilterShell
      urlPath="/real-estate-investment/reports/unit-preview"
      onPreview={handlePreview}
      onReset={() => {
        setFilters(defaultFilters());
        
      }}
      error={error}
      onClearError={() => setError('')}
      settingsOpen={showSettings}
      onSettingsOpenChange={setShowSettings}
    >
        <ReportFilterSection title="التواريخ">
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
        </ReportFilterSection>
        <ReportFilterSection title="المرشحات">
          <ReportFilterPartySelect
            label="العميل"
            kind="CUSTOMER"
            value={filters.customerId}
            onChange={(customerId) => patch({ customerId })}
            emptyLabel="كل العملاء"
          />
        </ReportFilterSection>
    </CatalogReportFilterShell>
  );
}
