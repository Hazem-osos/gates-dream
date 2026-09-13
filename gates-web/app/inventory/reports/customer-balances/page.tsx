'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CustomerBalancesPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/customer-balances"
      icon="📒"
      subtitle="أرصدة العملاء خلال الفترة."
      fields={{
        dates: 'range',
        customer: true,
        costCenter: true,
        currency: true,
        branch: true,
        allAccounts: true,
      }}
    />
  );
}
