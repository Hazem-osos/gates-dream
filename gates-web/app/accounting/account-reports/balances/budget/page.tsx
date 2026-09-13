'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function BudgetPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/balances/budget"
      icon="💼"
      subtitle="مقارنة الميزانية بالأرصدة الفعلية."
      fields={{
        dates: 'range',
        costCenter: true,
        currency: true,
        branch: true,
      }}
    />
  );
}
