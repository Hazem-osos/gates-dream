'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SalesAndReturnsReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/sales-and-returns-reports"
      icon="🔁"
      subtitle="المبيعات والمردودات معاً خلال الفترة."
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
