'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';
import { ReportFilterDate, ReportFilterField, reportFilterInputClass } from '@/components/report/reportFilterFields';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

export default function GuaranteeLettersReportsPage() {
  
  const [showSettings, setShowSettings] = useState(false);
useBackendReachability();
  const router = useRouter();
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  const handlePreview = () => {
    const params = new URLSearchParams({ fromDate, toDate });
    router.push(`/importexport/reports/guarantee-letters-reports/preview?${params.toString()}`);
  };

  return (
    <CatalogReportFilterShell
      urlPath="/importexport/reports/guarantee-letters-reports"
      onPreview={handlePreview}
      error={error}
      onClearError={() => setError('')}
      settingsOpen={showSettings}
      onSettingsOpenChange={setShowSettings}
      subtitle="خطابات الضمان ضمن الفترة المحددة."
    >
      <ReportFilterDate label="من تاريخ" value={fromDate} onChange={setFromDate} />
      <ReportFilterDate label="إلى تاريخ" value={toDate} onChange={setToDate} />
      <ReportFilterField label="حساب الضمان">
        <input type="text" className={reportFilterInputClass} placeholder="حساب الضمان" />
      </ReportFilterField>
    </CatalogReportFilterShell>
  );
}
