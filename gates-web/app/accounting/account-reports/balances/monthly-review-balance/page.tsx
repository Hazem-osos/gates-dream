'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function MonthlyReviewBalancePage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/balances/monthly-review-balance"
      icon="📅"
      subtitle="رصيد ما قبل الفترة، ثم مدين ودائن كل شهر، ثم الإجمالي."
      defaultFullCalendarYear
      fields={{ dates: 'range', branch: true, reportOptions: ['showIdleAccounts', 'showUnposted'] }}
    />
  );
}
