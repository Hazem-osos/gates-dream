'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SupplierAccountsReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/supplier-accounts-reports"
      icon="🏭"
      subtitle="كشف حساب الموردين خلال الفترة."
      fields={{
        dates: 'range',
        supplier: true,
        currency: true,
        branch: true,
        allAccounts: true,
      }}
    />
  );
}
