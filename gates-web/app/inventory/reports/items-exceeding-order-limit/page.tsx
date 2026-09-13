'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function ItemsExceedingOrderLimitPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/items-exceeding-order-limit"
      icon="⚠️"
      subtitle="أصناف تجاوزت حد الطلب في المخزن."
      fields={{ dates: 'none', warehouse: true, branch: true }}
    />
  );
}
