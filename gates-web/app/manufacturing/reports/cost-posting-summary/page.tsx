'use client';

import { useState } from 'react';
import { ManufacturingCostPostingSummaryResults } from '@/components/manufacturing/ManufacturingCostPostingSummaryResults';
import { ManufacturingReportChrome } from '@/components/manufacturing/ManufacturingReportChrome';
import {
  ReportFilterDate,
  ReportFilterField,
  ReportFilterSection,
} from '@/components/report/reportFilterFields';
import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { compactControlClass } from '@/components/ui';

const defaultFilters = () => ({
  ...reportDefaultDateRange(),
  warehouseIdRaw: '',
  warehouseIdFinished: '',
  costCenter: '',
  postedOnly: true,
});

export default function CostPostingSummaryReportPage() {
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const patch = (p: Partial<ReturnType<typeof defaultFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  return (
    <ManufacturingReportChrome
      title="ملخص تكاليف الإنتاج والترحيل"
      onPreview={() => {
        const params: Record<string, string> = {};
        if (filters.fromDate) params.fromDate = filters.fromDate;
        if (filters.toDate) params.toDate = filters.toDate;
        if (filters.warehouseIdRaw) params.warehouseIdRaw = filters.warehouseIdRaw;
        if (filters.warehouseIdFinished) params.warehouseIdFinished = filters.warehouseIdFinished;
        if (filters.costCenter) params.costCenter = filters.costCenter;
        if (filters.postedOnly) params.postedOnly = 'true';
        setPreviewQuery(params);
      }}
      onReset={() => {
        setFilters(defaultFilters());
        setPreviewQuery(null);
      }}
      below={
        previewQuery ? <ManufacturingCostPostingSummaryResults query={previewQuery} /> : null
      }
    >
      <ReportFilterSection title="الفترة (إنشاء / تأكيد / إتمام)">
        <ReportFilterDate
          label="من"
          value={filters.fromDate}
          onChange={(fromDate) => patch({ fromDate })}
        />
        <ReportFilterDate label="إلى" value={filters.toDate} onChange={(toDate) => patch({ toDate })} />
      </ReportFilterSection>
      <ReportFilterSection title="مرشحات">
        <ReportFilterField label="مخزن خامات">
          <WarehouseSelect
            value={filters.warehouseIdRaw}
            onChange={(warehouseIdRaw) => patch({ warehouseIdRaw })}
            className={compactControlClass}
            allowEmpty
            emptyLabel="كل المخازن"
          />
        </ReportFilterField>
        <ReportFilterField label="مخزن منتج تام">
          <WarehouseSelect
            value={filters.warehouseIdFinished}
            onChange={(warehouseIdFinished) => patch({ warehouseIdFinished })}
            className={compactControlClass}
            allowEmpty
            emptyLabel="كل المخازن"
          />
        </ReportFilterField>
        <ReportFilterField label="مركز التكلفة">
          <CostCenterSelect
            value={filters.costCenter}
            onChange={(costCenter) => patch({ costCenter })}
            className={compactControlClass}
            allowEmpty
            emptyLabel="كل المراكز"
            leafOnly
          />
        </ReportFilterField>
        <ReportFilterField label="الترحيل">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.postedOnly}
              onChange={(e) => patch({ postedOnly: e.target.checked })}
            />
            أوامر بها ترحيل محاسبي فقط
          </label>
        </ReportFilterField>
      </ReportFilterSection>
    </ManufacturingReportChrome>
  );
}
