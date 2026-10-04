'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SalesReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/sales-reports"
      icon="🧾"
      subtitle="فواتير المبيعات ضمن الفترة والمرشحات المحددة."
      defaults={{ unpaidOnly: false }}
      fields={{
        dates: 'range',
        customer: true,
        delegate: true,
        seller: false,
        driver: true,
        distributor: true,
        itemGroup: true,
        financialPresence: true,
        warehouse: true,
        item: true,
        costCenter: true,
        invoiceRange: true,
        currency: true,
        branch: true,
        sortBy: true,
        unpaidOnly: true,
        showUnposted: true,
        allAccounts: true,
      }}
    />
  );
}
