'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function AccountsBalancePage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/balances/accounts-balance"
      icon="📈"
      subtitle="أرصدة في تاريخ المركز المالي مقارنة بتاريخ آخر."
      fields={{
        dates: 'financialPositionCompare',
        account: true,
        costCenter: true,
        currency: true,
        branch: true,
        reportOptions: ['withBudgetOnly'],
      }}
    />
  );
}
