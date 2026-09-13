'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function MonthlyReviewBalancePage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/balances/monthly-review-balance"
      icon="📅"
      subtitle="ميزان المراجعة لفترة شهرية محددة."
      fields={{ dates: 'range', branch: true }}
    />
  );
}
