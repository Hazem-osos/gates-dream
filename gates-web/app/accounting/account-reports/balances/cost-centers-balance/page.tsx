'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function CostCentersBalancePage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/balances/cost-centers-balance"
      icon="📉"
      subtitle="موازنة كل مركز تكلفة مقابل رصيده: الموازنة، الرصيد السابق وآخر الفترة، المتبقي، والانحراف."
      fields={{
        dates: 'range',
        costCenter: { placeholder: 'كل مراكز التكلفة' },
        currency: true,
        branch: true,
        compareYear: true,
        reportOptions: ['withBudgetOnly'],
      }}
    />
  );
}
