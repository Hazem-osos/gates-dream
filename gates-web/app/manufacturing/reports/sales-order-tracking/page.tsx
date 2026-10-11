'use client';

import { useState } from 'react';
import { ManufacturingSalesOrderTrackingResults } from '@/components/manufacturing/ManufacturingSalesOrderTrackingResults';
import { ManufacturingReportChrome } from '@/components/manufacturing/ManufacturingReportChrome';
import {
  ReportFilterCheckbox,
  ReportFilterDate,
  ReportFilterField,
  ReportFilterItemSelect,
  ReportFilterPartySelect,
  ReportFilterSection,
  ReportFilterWarehouseSelect,
} from '@/components/report/reportFilterFields';
import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';
import { compactControlClass } from '@/components/ui';

export default function SalesOrderTrackingReportPage() {
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);
  const [showManufacturingDetails, setShowManufacturingDetails] = useState(false);
  const [filters, setFilters] = useState(() => ({
    ...reportDefaultDateRange(),
    invoiceNumber: '',
    customerId: '',
    itemId: '',
    warehouseId: '',
  }));

  const patch = (p: Partial<typeof filters>) => setFilters((prev) => ({ ...prev, ...p }));

  return (
    <ManufacturingReportChrome
      title="تقرير أوامر البيع"
      onPreview={() => {
        const params: Record<string, string> = {};
        if (filters.fromDate) params.fromDate = filters.fromDate;
        if (filters.toDate) params.toDate = filters.toDate;
        if (filters.invoiceNumber.trim()) params.invoiceNumber = filters.invoiceNumber.trim();
        if (filters.customerId) params.customerId = filters.customerId;
        if (filters.itemId) params.itemId = filters.itemId;
        if (filters.warehouseId) params.warehouseId = filters.warehouseId;
        setPreviewQuery(params);
      }}
      onReset={() => {
        setFilters({
          ...reportDefaultDateRange(),
          invoiceNumber: '',
          customerId: '',
          itemId: '',
          warehouseId: '',
        });
        setShowManufacturingDetails(false);
        setPreviewQuery(null);
      }}
      below={
        previewQuery ? (
          <ManufacturingSalesOrderTrackingResults
            query={previewQuery}
            showManufacturingDetails={showManufacturingDetails}
          />
        ) : null
      }
    >
      <ReportFilterSection title="التواريخ">
        <ReportFilterDate
          label="من"
          value={filters.fromDate}
          onChange={(fromDate) => patch({ fromDate })}
        />
        <ReportFilterDate
          label="إلى"
          value={filters.toDate}
          onChange={(toDate) => patch({ toDate })}
        />
      </ReportFilterSection>
      <ReportFilterSection title="مرشحات">
        <ReportFilterField label="رقم أمر البيع">
          <input
            className={compactControlClass}
            value={filters.invoiceNumber}
            onChange={(e) => patch({ invoiceNumber: e.target.value })}
          />
        </ReportFilterField>
        <ReportFilterPartySelect
          label="العميل"
          kind="CUSTOMER"
          value={filters.customerId}
          onChange={(customerId) => patch({ customerId })}
          emptyLabel="كل العملاء"
        />
        <ReportFilterItemSelect
          label="الصنف"
          value={filters.itemId}
          onChange={(itemId) => patch({ itemId })}
        />
        <ReportFilterWarehouseSelect
          label="المخزن"
          value={filters.warehouseId}
          onChange={(warehouseId) => patch({ warehouseId })}
        />
      </ReportFilterSection>
      <ReportFilterCheckbox
        id="so-report-mfg-details"
        label="تفاصيل التصنيع (أوامر الشغل والنماذج)"
        checked={showManufacturingDetails}
        onChange={setShowManufacturingDetails}
      />
    </ManufacturingReportChrome>
  );
}
