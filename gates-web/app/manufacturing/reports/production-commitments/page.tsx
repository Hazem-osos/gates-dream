'use client';

import { useState } from 'react';
import { ManufacturingProductionCommitmentsResults } from '@/components/manufacturing/ManufacturingProductionCommitmentsResults';
import { ManufacturingReportChrome } from '@/components/manufacturing/ManufacturingReportChrome';
import {
  ReportFilterDate,
  ReportFilterField,
  ReportFilterSection,
} from '@/components/report/reportFilterFields';
import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';
import { compactControlClass } from '@/components/ui';

export default function ProductionCommitmentsReportPage() {
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);
  const [filters, setFilters] = useState(() => ({
    ...reportDefaultDateRange(),
    invoiceNumber: '',
    includeCompleted: false,
  }));

  const patch = (p: Partial<typeof filters>) => setFilters((prev) => ({ ...prev, ...p }));

  return (
    <ManufacturingReportChrome
      title="التزامات الإنتاج والتسليم"
      onPreview={() => {
        const params: Record<string, string> = {};
        if (filters.fromDate) params.fromDate = filters.fromDate;
        if (filters.toDate) params.toDate = filters.toDate;
        if (filters.invoiceNumber.trim()) params.invoiceNumber = filters.invoiceNumber.trim();
        if (filters.includeCompleted) params.includeCompleted = 'true';
        setPreviewQuery(params);
      }}
      onReset={() => {
        setFilters({ ...reportDefaultDateRange(), invoiceNumber: '', includeCompleted: false });
        setPreviewQuery(null);
      }}
      below={
        previewQuery ? <ManufacturingProductionCommitmentsResults query={previewQuery} /> : null
      }
    >
      <ReportFilterSection title="فترة التقرير (حسب تاريخ أمر البيع)">
        <div className="col-span-full grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <ReportFilterDate
            label="من تاريخ"
            value={filters.fromDate}
            onChange={(v) => patch({ fromDate: v })}
          />
          <ReportFilterDate
            label="إلى تاريخ"
            value={filters.toDate}
            onChange={(v) => patch({ toDate: v })}
          />
        </div>
      </ReportFilterSection>
      <ReportFilterSection title="مرشحات">
        <ReportFilterField label="رقم أمر البيع">
          <input
            className={compactControlClass}
            value={filters.invoiceNumber}
            onChange={(e) => patch({ invoiceNumber: e.target.value })}
          />
        </ReportFilterField>
        <ReportFilterField label="عرض المكتملة">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.includeCompleted}
              onChange={(e) => patch({ includeCompleted: e.target.checked })}
            />
            إظهار أوامر البيع المكتملة تصنيعاً
          </label>
        </ReportFilterField>
      </ReportFilterSection>
    </ManufacturingReportChrome>
  );
}
