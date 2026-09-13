'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function ExpiryDateReportPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/expiry-date-report"
      icon="⏳"
      subtitle="أصناف قاربت أو انتهت صلاحيتها."
      fields={{
        dates: 'range',
        delegate: true,
        warehouse: true,
        itemGroup: true,
        item: true,
        costCenter: true,
        invoiceRange: true,
        branch: true,
      }}
    />
  );
}
