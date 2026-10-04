'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function AccountBalancesPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/credit/account-balances"
      icon="💳"
      subtitle="شجرة الحسابات مع الرصيد السابق وحركة الفترة والرصيد الحالي."
      fields={{
        dates: 'range',
        account: true,
        costCenter: true,
        currency: true,
        branch: true,
        customer: true,
        supplier: true,
      }}
    />
  );
}
