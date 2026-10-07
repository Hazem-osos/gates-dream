'use client';

import { useState } from 'react';
import { ManufacturingWorkOrderTrackingResults } from '@/components/manufacturing/ManufacturingWorkOrderTrackingResults';
import { ManufacturingReportChrome } from '@/components/manufacturing/ManufacturingReportChrome';
import {
  ReportFilterDate,
  ReportFilterField,
  ReportFilterSection,
  ReportFilterSelect,
} from '@/components/report/reportFilterFields';
import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';
import { compactControlClass } from '@/components/ui';

const STATUS_OPTIONS = [
  { value: '', label: 'كل المواقف' },
  { value: 'CONFIRMED', label: 'تم التأكيد' },
  { value: 'OPEN', label: 'تم التأكيد (قديم)' },
  { value: 'IN_PROGRESS', label: 'قيد التنفيذ' },
  { value: 'COMPLETED', label: 'منتهي' },
  { value: 'CLOSED', label: 'مغلق' },
];

export default function WorkOrderTrackingReportPage() {
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);
  const [filters, setFilters] = useState(() => ({
    ...reportDefaultDateRange(),
    status: '',
    orderNumber: '',
  }));

  const patch = (p: Partial<typeof filters>) => setFilters((prev) => ({ ...prev, ...p }));

  return (
    <ManufacturingReportChrome
      title="متابعة أوامر الشغل"
      onPreview={() => {
        const params: Record<string, string> = {};
        if (filters.fromDate) params.fromDate = filters.fromDate;
        if (filters.toDate) params.toDate = filters.toDate;
        if (filters.status) params.status = filters.status;
        if (filters.orderNumber.trim()) params.orderNumber = filters.orderNumber.trim();
        setPreviewQuery(params);
      }}
      onReset={() => {
        setFilters({ ...reportDefaultDateRange(), status: '', orderNumber: '' });
        setPreviewQuery(null);
      }}
      below={previewQuery ? <ManufacturingWorkOrderTrackingResults query={previewQuery} /> : null}
    >
      <ReportFilterSection title="التواريخ">
        <ReportFilterDate label="من" value={filters.fromDate} onChange={(v) => patch({ fromDate: v })} />
        <ReportFilterDate label="إلى" value={filters.toDate} onChange={(v) => patch({ toDate: v })} />
      </ReportFilterSection>
      <ReportFilterSection title="مرشحات">
        <ReportFilterSelect
          label="موقف أمر الشغل"
          value={filters.status}
          onChange={(status) => patch({ status })}
          options={STATUS_OPTIONS}
        />
        <ReportFilterField label="رقم أمر الشغل">
          <input
            className={compactControlClass}
            value={filters.orderNumber}
            onChange={(e) => patch({ orderNumber: e.target.value })}
          />
        </ReportFilterField>
      </ReportFilterSection>
    </ManufacturingReportChrome>
  );
}
