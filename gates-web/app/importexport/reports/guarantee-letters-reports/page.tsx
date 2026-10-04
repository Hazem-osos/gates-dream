'use client';

import { useState } from 'react';
import { InlineReportResults } from '@/components/report/InlineReportResults';
import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';
import { ReportFilterDate, ReportFilterField, reportFilterInputClass } from '@/components/report/reportFilterFields';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';

export default function GuaranteeLettersReportsPage() {
  
  const [showSettings, setShowSettings] = useState(false);
useBackendReachability();
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);
  const [fromDate, setFromDate] = useState(() => reportDefaultDateRange().fromDate);
  const [toDate, setToDate] = useState(() => reportDefaultDateRange().toDate);
  const [error, setError] = useState('');

  const handlePreview = () => {
    const params = new URLSearchParams({ fromDate, toDate });
    setPreviewQuery(Object.fromEntries(params));
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
      below={previewQuery ? <InlineReportResults urlPath="/importexport/reports/guarantee-letters-reports" query={previewQuery} /> : null}
    >
      <ReportFilterDate label="من تاريخ" value={fromDate} onChange={setFromDate} />
      <ReportFilterDate label="إلى تاريخ" value={toDate} onChange={setToDate} />
      <ReportFilterField label="حساب الضمان">
        <input type="text" className={reportFilterInputClass} placeholder="حساب الضمان" />
      </ReportFilterField>
    </CatalogReportFilterShell>
  );
}
