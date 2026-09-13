'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function AccountBalancesPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/credit/account-balances"
      icon="💳"
      subtitle="أرصدة الحسابات حتى تاريخ محدد."
      fields={{
        dates: 'to',
        account: true,
        costCenter: true,
        currency: true,
        branch: true,
      }}
    />
  );
}
