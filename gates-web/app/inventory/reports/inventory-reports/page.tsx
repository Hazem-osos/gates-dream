'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function InventoryReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/inventory-reports"
      icon="📦"
      subtitle="أرصدة الأصناف حتى تاريخ، مع المحجوز والمتاح وقيمة المخزون."
      fields={{
        dates: 'to',
        warehouse: true,
        warehouseScope: 'all',
        itemGroup: true,
        item: true,
        currency: true,
        stockCount: true,
        user: false,
      }}
    />
  );
}
