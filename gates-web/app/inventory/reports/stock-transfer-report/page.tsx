'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function StockTransferReportPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/stock-transfer-report"
      icon="🔁"
      subtitle="حركات النقل بين المخازن خلال الفترة."
      fields={{
        dates: 'range',
        warehouse: true,
        branch: true,
        showUnposted: true,
      }}
    />
  );
}
