'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CustomerAccountsCurrencyReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/customer-accounts-currency-reports"
      icon="💱"
      subtitle="كشف حساب لكل عميل: الكود والاسم أولاً، وبعدين التاريخ والرقم والشرح، ومدين ودائن ورصيد لكل عملة معرّفة في الشركة. العملة اختيارية لو عايز عملة واحدة بس."
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
