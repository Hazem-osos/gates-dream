'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function ItemsProfitReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/items-profit-reports"
      icon="💹"
      subtitle="أرباح الأصناف خلال الفترة."
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
        allAccounts: true,
      }}
    />
  );
}
