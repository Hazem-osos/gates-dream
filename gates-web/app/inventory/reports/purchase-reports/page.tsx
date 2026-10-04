'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function PurchaseReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/purchase-reports"
      icon="🛒"
      subtitle="فواتير المشتريات ضمن الفترة. المسودات لا تظهر في التقرير."
      defaults={{ showUnposted: false }}
      fields={{
        dates: 'range',
        supplier: true,
        delegate: true,
        driver: true,
        distributor: true,
        warehouse: true,
        itemGroup: true,
        item: true,
        costCenter: true,
        currency: true,
        branch: true,
        invoiceRange: true,
        sortBy: true,
        unpaidOnly: true,
        showUnposted: true,
        financialPresence: true,
        allAccounts: true,
      }}
    />
  );
}
