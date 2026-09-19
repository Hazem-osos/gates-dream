'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function FinancialPapersFlowPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/moves/financial-papers-flow"
      icon="📜"
      subtitle="تدفقات أوراق القبض والدفع."
      fields={{
        dates: 'range',
        account: true,
        costCenter: true,
        branch: true,
        entity: true,
      }}
    />
  );
}
