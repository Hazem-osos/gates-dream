'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function AccountsBalancePage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/balances/accounts-balance"
      icon="📈"
      subtitle="موازنة أرصدة الحسابات خلال الفترة."
      fields={{
        dates: 'range',
        account: true,
        costCenter: true,
        currency: true,
        branch: true,
      }}
    />
  );
}
