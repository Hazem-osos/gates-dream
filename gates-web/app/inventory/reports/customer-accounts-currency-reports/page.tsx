'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CustomerAccountsCurrencyReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/customer-accounts-currency-reports"
      icon="💱"
      subtitle="حسابات العملاء حسب العملة."
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
