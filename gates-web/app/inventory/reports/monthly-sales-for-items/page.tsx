'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function MonthlySalesForItemsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/monthly-sales-for-items"
      icon="📅"
      subtitle="حدد الفترة من فوق. كل شهر من الاثني عشر شهرًا يظهر بكمية وقيمة، ثم الإجمالي. المردود يخصم من الشهر."
      fields={{
        dates: 'range',
        warehouse: true,
        warehouseScope: 'all',
        item: true,
        itemGroup: true,
        currency: true,
        branch: true,
        reportOptions: ['hideUnsoldItems'],
      }}
    />
  );
}
