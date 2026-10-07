'use client';

import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';

import { useMemo, useState } from 'react';
import { ManufacturingCostVarianceReportResults } from '@/components/manufacturing/ManufacturingCostVarianceReportResults';
import { ManufacturingReportChrome } from '@/components/manufacturing/ManufacturingReportChrome';
import {
  ReportFilterCheckbox,
  ReportFilterCostCenterSelect,
  ReportFilterDate,
  ReportFilterField,
  ReportFilterSection,
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

export default function CostVariancePage() {
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState('');
  const [showUnposted, setShowUnposted] = useState(true);
  const [varManufactured, setVarManufactured] = useState(true);
  const [varRaw, setVarRaw] = useState(false);
  const [varAdditional, setVarAdditional] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const patch = (p: Partial<ReturnType<typeof defaultFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const { data: bomsResponse } = useApiQuery<{ id: string; name: string }[]>(
    ['manufacturing-boms-cost-var'],
    '/manufacturing/boms'
  );
  const bomOptions = (bomsResponse?.data ?? []).map((b) => ({ value: b.id, label: b.name }));

  const showItems = varManufactured || varRaw;
  const showAdditional = varAdditional;

  const varianceTypes = useMemo(() => {
    const parts: string[] = [];
    if (varManufactured) parts.push('manufactured');
    if (varRaw) parts.push('raw');
    if (varAdditional) parts.push('additional');
    return parts.join(',') || 'manufactured';
  }, [varManufactured, varRaw, varAdditional]);

  const handlePreview = () => {
    if (!filters.fromDate || !filters.toDate) {
      setError('يرجى اختيار تاريخ البداية والنهاية');
      return;
    }
    if (!varManufactured && !varRaw && !varAdditional) {
      setError('اختر نوعاً واحداً على الأقل تحت «انحراف»');
      return;
    }
    const params: Record<string, string> = {
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      varianceTypes,
      showUnposted: showUnposted ? 'true' : 'false',
    };
    if (filters.bomId) params.bomId = filters.bomId;
    if (filters.stage.trim()) params.stage = filters.stage.trim();
    if (filters.costCenterId) params.costCenterId = filters.costCenterId;
    setError('');
    setPreviewQuery(params);
  };

  return (
    <ManufacturingReportChrome
      title="إنحراف تكاليف التصنيع"
      onPreview={handlePreview}
      onReset={() => {
        setFilters(defaultFilters());
        setShowUnposted(true);
        setVarManufactured(true);
        setVarRaw(false);
        setVarAdditional(false);
        setPreviewQuery(null);
      }}
      error={error}
      onClearError={() => setError('')}
      below={
        previewQuery ? (
          <ManufacturingCostVarianceReportResults
            query={previewQuery}
            showItems={showItems}
            showAdditional={showAdditional}
          />
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
      <ReportFilterSection title="انحراف">
        <ReportFilterCheckbox
          id="var-manufactured"
          label="الأصناف المصنعة"
          checked={varManufactured}
          onChange={setVarManufactured}
        />
        <ReportFilterCheckbox
          id="var-raw"
          label="الأصناف الأولية"
          checked={varRaw}
          onChange={setVarRaw}
        />
        <ReportFilterCheckbox
          id="var-additional"
          label="التكاليف الإضافية"
          checked={varAdditional}
          onChange={setVarAdditional}
        />
      </ReportFilterSection>
      <ReportFilterCheckbox
        id="showUnposted-cost"
        label="إظهار العمليات غير المرحّلة"
        checked={showUnposted}
        onChange={setShowUnposted}
      />
    </ManufacturingReportChrome>
  );
}
