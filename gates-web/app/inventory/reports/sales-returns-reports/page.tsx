'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SalesReturnsReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/sales-returns-reports"
      icon="↩️"
      subtitle="مردودات المبيعات ضمن الفترة والمرشحات المحددة."
      fields={{
        dates: 'range',
        customer: true,
        delegate: true,
        driver: true,
        distributor: true,
        warehouse: true,
        itemGroup: true,
        item: true,
        costCenter: true,
        invoiceRange: true,
        currency: true,
        branch: true,
        sortBy: true,
        unpaidOnly: true,
        showUnposted: true,
        financialPresence: true,
        allAccounts: true,
      }}
    />
  );
}
