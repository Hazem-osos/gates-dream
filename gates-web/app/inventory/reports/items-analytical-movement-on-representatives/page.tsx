'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function ItemsAnalyticalMovementOnRepresentativesPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/items-analytical-movement-on-representatives"
      icon="📈"
      subtitle="حركة الأصناف موزّعة على المندوبين."
      fields={{
        dates: 'range',
        customer: true,
        delegate: true,
        warehouse: true,
        itemGroup: true,
        item: true,
        costCenter: true,
        invoiceRange: true,
        currency: true,
        branch: true,
        unpaidOnly: true,
        allAccounts: true,
      }}
    />
  );
}
