'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function PurchaseReturnsReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/purchase-returns-reports"
      icon="↩️"
      subtitle="مردودات المشتريات خلال الفترة."
      fields={{
        dates: 'range',
        supplier: true,
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
