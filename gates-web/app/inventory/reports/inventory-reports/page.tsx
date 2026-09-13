'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function InventoryReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/inventory-reports"
      icon="📦"
      subtitle="أرصدة الأصناف في المخازن حتى نهاية الفترة."
      fields={{
        dates: 'range',
        warehouse: true,
        item: true,
        currency: true,
        branch: true,
      }}
    />
  );
}
