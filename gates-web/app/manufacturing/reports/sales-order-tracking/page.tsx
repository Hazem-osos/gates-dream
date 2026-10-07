'use client';

import { useState } from 'react';
import { ManufacturingSalesOrderTrackingResults } from '@/components/manufacturing/ManufacturingSalesOrderTrackingResults';
import { ManufacturingReportChrome } from '@/components/manufacturing/ManufacturingReportChrome';
import {
  ReportFilterDate,
  ReportFilterField,
  ReportFilterSection,
} from '@/components/report/reportFilterFields';
import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';
import { compactControlClass } from '@/components/ui';

export default function SalesOrderTrackingReportPage() {
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);
  const [filters, setFilters] = useState(() => ({
    ...reportDefaultDateRange(),
    invoiceNumber: '',
  }));

  return (
    <ManufacturingReportChrome
      title="متابعة أوامر البيع (التصنيع)"
      onPreview={() => {
        const params: Record<string, string> = {};
        if (filters.fromDate) params.fromDate = filters.fromDate;
        if (filters.toDate) params.toDate = filters.toDate;
        if (filters.invoiceNumber.trim()) params.invoiceNumber = filters.invoiceNumber.trim();
        setPreviewQuery(params);
      }}
      onReset={() => {
        setFilters({ ...reportDefaultDateRange(), invoiceNumber: '' });
        setPreviewQuery(null);
      }}
      below={previewQuery ? <ManufacturingSalesOrderTrackingResults query={previewQuery} /> : null}
    >
      <ReportFilterSection title="التواريخ">
        <ReportFilterDate
          label="من"
          value={filters.fromDate}
          onChange={(fromDate) => setFilters((p) => ({ ...p, fromDate }))}
        />
        <ReportFilterDate
          label="إلى"
          value={filters.toDate}
          onChange={(toDate) => setFilters((p) => ({ ...p, toDate }))}
        />
      </ReportFilterSection>
      <ReportFilterSection title="مرشحات">
        <ReportFilterField label="رقم أمر البيع">
          <input
            className={compactControlClass}
            value={filters.invoiceNumber}
            onChange={(e) => setFilters((p) => ({ ...p, invoiceNumber: e.target.value }))}
          />
        </ReportFilterField>
      </ReportFilterSection>
    </ManufacturingReportChrome>
  );
}
