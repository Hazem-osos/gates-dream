'use client';

import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';

import { useState } from 'react';
import { ManufacturingMovementsReportResults } from '@/components/manufacturing/ManufacturingMovementsReportResults';
import { ManufacturingReportChrome } from '@/components/manufacturing/ManufacturingReportChrome';
import {
  ReportFilterCheckbox,
  ReportFilterCostCenterSelect,
  ReportFilterDate,
  ReportFilterSection,
  ReportFilterField,
  ReportFilterSelect,
} from '@/components/report/reportFilterFields';
import { useApiQuery } from '@/lib/hooks/useApi';
import { compactControlClass } from '@/components/ui';

const defaultFilters = () => ({
  ...reportDefaultDateRange(),
  bomId: '',
  stage: '',
  costCenterId: '',
});

export default function ManufacturingMovementsPage() {
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState('');
  const [showUnposted, setShowUnposted] = useState(true);
  const [showAnalyticalReport, setShowAnalyticalReport] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const patch = (p: Partial<ReturnType<typeof defaultFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const { data: bomsResponse } = useApiQuery<{ id: string; name: string }[]>(
    ['manufacturing-boms-report'],
    '/manufacturing/boms'
  );
  const bomOptions = (bomsResponse?.data ?? []).map((b) => ({ value: b.id, label: b.name }));

  const handlePreview = () => {
    if (!filters.fromDate || !filters.toDate) {
      setError('يرجى اختيار تاريخ البداية والنهاية');
      return;
    }
    const params: Record<string, string> = {
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    };
    if (filters.bomId) params.bomId = filters.bomId;
    if (filters.stage.trim()) params.stage = filters.stage.trim();
    if (filters.costCenterId) params.costCenterId = filters.costCenterId;
    params.showUnposted = showUnposted ? 'true' : 'false';
    setError('');
    setPreviewQuery(params);
  };

  return (
    <ManufacturingReportChrome
      title="حركات التصنيع"
      onPreview={handlePreview}
      onReset={() => {
        setFilters(defaultFilters());
        setShowUnposted(true);
        setShowAnalyticalReport(false);
        setPreviewQuery(null);
      }}
      error={error}
      onClearError={() => setError('')}
      below={
        previewQuery ? (
          <ManufacturingMovementsReportResults query={previewQuery} showAnalyticalReport={showAnalyticalReport} />
        ) : null
      }
    >
      <ReportFilterSection title="التواريخ">
        <ReportFilterDate label="من تاريخ" value={filters.fromDate} onChange={(fromDate) => patch({ fromDate })} />
        <ReportFilterDate label="إلى تاريخ" value={filters.toDate} onChange={(toDate) => patch({ toDate })} />
      </ReportFilterSection>
      <ReportFilterSection title="المرشحات">
        <ReportFilterSelect
          label="النموذج"
          value={filters.bomId}
          onChange={(bomId) => patch({ bomId })}
          options={bomOptions}
          placeholder="كل النماذج"
        />
        <ReportFilterField label="المرحلة">
          <input
            className={compactControlClass}
            value={filters.stage}
            onChange={(e) => patch({ stage: e.target.value })}
            placeholder="كل المراحل"
          />
        </ReportFilterField>
        <ReportFilterCostCenterSelect
          label="مركز التكلفة"
          value={filters.costCenterId}
          onChange={(costCenterId) => patch({ costCenterId })}
        />
      </ReportFilterSection>
      <ReportFilterCheckbox
        id="showUnposted-mov"
        label="إظهار العمليات غير المرحّلة"
        checked={showUnposted}
        onChange={setShowUnposted}
      />
      <ReportFilterCheckbox
        id="show-analytical-mov"
        label="إظهار التقرير التحليلي"
        checked={showAnalyticalReport}
        onChange={setShowAnalyticalReport}
      />
    </ManufacturingReportChrome>
  );
}
