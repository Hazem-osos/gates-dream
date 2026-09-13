'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SalesReturnsReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/sales-returns-reports"
      icon="↩️"
      subtitle="مردودات المبيعات خلال الفترة."
      fields={{
        dates: 'range',
        customer: true,
        delegate: true,
        warehouse: true,
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
