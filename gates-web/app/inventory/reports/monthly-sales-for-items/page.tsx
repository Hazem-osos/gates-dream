'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function MonthlySalesForItemsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/monthly-sales-for-items"
      icon="📅"
      subtitle="مبيعات الأصناف مجمّعة شهرياً."
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
