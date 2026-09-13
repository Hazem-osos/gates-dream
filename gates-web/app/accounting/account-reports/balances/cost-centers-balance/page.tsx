'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function CostCentersBalancePage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/balances/cost-centers-balance"
      icon="📉"
      subtitle="أرصدة كل مراكز التكلفة خلال الفترة."
      fields={{
        dates: 'range',
        costCenter: true,
        currency: true,
        branch: true,
      }}
    />
  );
}
