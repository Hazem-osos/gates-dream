'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function SuppliersBalancesPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/credit/suppliers-balances"
      icon="🏭"
      subtitle="أرصدة الموردين حسب مركز التكلفة."
      fields={{
        dates: 'range',
        supplier: true,
        currency: true,
        branch: true,
      }}
    />
  );
}
