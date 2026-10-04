'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function ItemsExceedingOrderLimitPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/items-exceeding-order-limit"
      icon="⚠️"
      subtitle="أصناف رصيدها عند حد الطلب أو أقل حتى نهاية الفترة."
      fields={{
        dates: 'range',
        warehouse: true,
        item: true,
        itemGroup: true,
        branch: true,
        limitStatus: true,
        reportOptions: ['showEmpty', 'inactiveOnly', 'activeOnly', 'negativeOnly', 'nonNegativeOnly'],
        groupByLayout: true,
      }}
    />
  );
}
