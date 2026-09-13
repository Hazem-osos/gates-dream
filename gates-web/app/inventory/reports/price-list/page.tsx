'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function PriceListPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/price-list"
      icon="💲"
      subtitle="أسعار الأصناف حسب المجموعة."
      fields={{ dates: 'none', itemGroup: true, item: true, branch: true }}
    />
  );
}
