'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';
import { expiryReportDefaultDates } from '@/lib/reports/reportDefaultDates';

export default function ExpiryDateReportPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/expiry-date-report"
      icon="⏳"
      subtitle="تواريخ الصلاحية المسجّلة على الفواتير وبضاعة أول المدة. الفترة هنا تاريخ الصلاحية نفسه."
      defaults={expiryReportDefaultDates()}
      fields={{
        dates: 'range',
        delegate: true,
        warehouse: true,
        warehouseScope: 'all',
        itemGroup: true,
        item: true,
        costCenter: true,
        invoiceRange: true,
        branch: true,
        groupByLayout: true,
      }}
    />
  );
}
