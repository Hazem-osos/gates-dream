'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function StockProfitReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/stock-profit-reports"
      icon="📦"
      subtitle="أرباح المخزون حتى تاريخ. سعر البيع من بطاقة الصنف أو من قائمة الأسعار المختارة."
      fields={{
        dates: 'to',
        warehouse: true,
        itemGroup: true,
        item: true,
        currency: true,
        stockProfit: true,
        groupByLayout: true,
      }}
    />
  );
}
