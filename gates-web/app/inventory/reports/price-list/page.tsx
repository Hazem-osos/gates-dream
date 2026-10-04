'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function PriceListPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/price-list"
      icon="💲"
      subtitle="سعر شراء وبيع الصنف مقارنة بسعر شراء وبيع قائمة الأسعار."
      fields={{
        dates: 'none',
        priceList: true,
        warehouse: true,
        itemGroup: true,
        item: true,
        branch: true,
        showUnposted: false,
        reportOptions: ['showEmpty', 'inactiveOnly', 'activeOnly'],
        groupByLayout: true,
      }}
    />
  );
}
