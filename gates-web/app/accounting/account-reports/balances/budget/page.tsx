'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function BudgetPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/balances/budget"
      icon="💼"
      subtitle="الموازنة، الرصيد السابق وآخر الفترة، المتبقي، والانحراف ونسبه."
      fields={{
        dates: 'range',
        account: { placeholder: 'كل الحسابات' },
        costCenter: true,
        currency: true,
        branch: true,
        compareYear: true,
      }}
    />
  );
}
