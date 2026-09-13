'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function CostCenterBalanceePage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/balances/cost-center-balancee"
      icon="📉"
      subtitle="ميزان مراجعة لمركز تكلفة واحد حتى تاريخ محدد."
      fields={{
        dates: 'to',
        costCenter: { required: true, placeholder: 'اختر مركز التكلفة' },
        branch: true,
      }}
    />
  );
}
