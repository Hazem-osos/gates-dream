'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CustomerAccountsReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/customer-accounts-reports"
      icon="👤"
      subtitle="كشف حساب العملاء خلال الفترة."
      fields={{
        dates: 'range',
        customer: true,
        currency: true,
        branch: true,
        allAccounts: true,
      }}
    />
  );
}
