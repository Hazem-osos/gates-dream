'use client';

import { useState } from 'react';
import { ManufacturingOrderStatusReportResults } from '@/components/manufacturing/ManufacturingOrderStatusReportResults';
import { ManufacturingReportChrome } from '@/components/manufacturing/ManufacturingReportChrome';
import {
  ReportFilterDate,
  ReportFilterField,
  ReportFilterSection,
  ReportFilterSelect,
} from '@/components/report/reportFilterFields';
import { useApiQuery } from '@/lib/hooks/useApi';
import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { compactControlClass } from '@/components/ui';

const STATUS_OPTIONS = [
  { value: '', label: 'كل المواقف' },
  { value: 'RELEASED', label: 'تم التأكيد' },
  { value: 'IN_PROGRESS', label: 'قيد التنفيذ' },
  { value: 'COMPLETED', label: 'منتهي' },
  { value: 'CANCELLED', label: 'ملغي' },
];

const defaultFilters = () => ({
  ...reportDefaultDateRange(),
  status: '',
  bomId: '',
  warehouseIdRaw: '',
  warehouseIdFinished: '',
  orderNumber: '',
});

export default function ManufacturingOrderStatusReportPage() {
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const patch = (p: Partial<ReturnType<typeof defaultFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const { data: bomsResponse } = useApiQuery<{ id: string; name: string }[]>(
    ['manufacturing-boms-order-status'],
    '/manufacturing/boms'
  );
  const bomOptions = [
    { value: '', label: 'كل النماذج' },
    ...(bomsResponse?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
  ];

  const handlePreview = () => {
    const params: Record<string, string> = {};
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    if (filters.status) params.status = filters.status;
    if (filters.bomId) params.bomId = filters.bomId;
    if (filters.warehouseIdRaw) params.warehouseIdRaw = filters.warehouseIdRaw;
    if (filters.warehouseIdFinished) params.warehouseIdFinished = filters.warehouseIdFinished;
    if (filters.orderNumber.trim()) params.orderNumber = filters.orderNumber.trim();
    setError('');
    setPreviewQuery(params);
  };

  return (
    <ManufacturingReportChrome
      title="مواقف أوامر التصنيع"
      onPreview={handlePreview}
      onReset={() => {
        setFilters(defaultFilters());
        setPreviewQuery(null);
      }}
      error={error}
      onClearError={() => setError('')}
      below={
        previewQuery ? <ManufacturingOrderStatusReportResults query={previewQuery} /> : null
      }
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
        <ReportFilterSelect
          label="الموقف"
          value={filters.status}
          onChange={(status) => patch({ status })}
          options={STATUS_OPTIONS}
        />
        <ReportFilterSelect
          label="نموذج التصنيع"
          value={filters.bomId}
          onChange={(bomId) => patch({ bomId })}
          options={bomOptions}
        />
        <ReportFilterField label="رقم الأمر">
          <input
            className={compactControlClass}
            value={filters.orderNumber}
            onChange={(e) => patch({ orderNumber: e.target.value })}
            placeholder="بحث جزئي بالمسلسل"
          />
        </ReportFilterField>
        <ReportFilterField label="مخزن الخامات">
          <WarehouseSelect
            value={filters.warehouseIdRaw}
            onChange={(id) => patch({ warehouseIdRaw: id })}
            className={compactControlClass}
            emptyLabel="كل المخازن"
          />
        </ReportFilterField>
        <ReportFilterField label="مخزن المواد النهائية">
          <WarehouseSelect
            value={filters.warehouseIdFinished}
            onChange={(id) => patch({ warehouseIdFinished: id })}
            className={compactControlClass}
            emptyLabel="كل المخازن"
          />
        </ReportFilterField>
      </ReportFilterSection>
    </ManufacturingReportChrome>
  );
}
