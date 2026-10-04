'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SupplierAccountsReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/supplier-accounts-reports"
      icon="🏭"
      subtitle="كشف حساب المورد بنفس تفاصيل كشف العميل: التاريخ، رقم الفاتورة، مدين، دائن، الرصيد، والشرح حتى المندوب."
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
