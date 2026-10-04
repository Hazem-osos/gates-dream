'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function StockTransferReportPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/stock-transfer-report"
      icon="🔁"
      subtitle="كل نقل لوحده، والمسلسل يفتح شاشة النقل. الفترة على تاريخ النقل."
      fields={{
        dates: 'range',
        fromToWarehouse: true,
        item: true,
        itemGroup: true,
        branch: true,
        showUnposted: true,
      }}
    />
  );
}
