'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SupplierAccountsCurrenciesPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/supplier-accounts-currencies"
      icon="💱"
      subtitle="حسابات الموردين حسب العملة."
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
