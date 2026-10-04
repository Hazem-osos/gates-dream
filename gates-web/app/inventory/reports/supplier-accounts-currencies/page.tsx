'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SupplierAccountsCurrenciesPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/supplier-accounts-currencies"
      icon="💱"
      subtitle="كشف حساب لكل مورد: الكود والاسم أولاً، وبعدين التاريخ والرقم والشرح، ومدين ودائن ورصيد لكل عملة معرّفة في الشركة. العملة اختيارية لو عايز عملة واحدة بس."
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
