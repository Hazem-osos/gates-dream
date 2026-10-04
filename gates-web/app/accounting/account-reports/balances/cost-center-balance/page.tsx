'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function CostCenterBalancePage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/balances/cost-center-balance"
      icon="📉"
      subtitle="الحسابات في الصفوف، ومراكز التكلفة في الأعمدة، حتى التاريخ المختار."
      fields={{
        dates: 'to',
        costCenter: { placeholder: 'كل مراكز التكلفة' },
        account: { placeholder: 'كل الحسابات' },
        branch: true,
        reportOptions: ['withBudgetOnly'],
      }}
    />
  );
}
