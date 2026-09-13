'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function StockProfitReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/stock-profit-reports"
      icon="📦"
      subtitle="أرباح المخزون خلال الفترة."
      fields={{
        dates: 'range',
        warehouse: true,
        itemGroup: true,
        item: true,
        currency: true,
        branch: true,
      }}
    />
  );
}
