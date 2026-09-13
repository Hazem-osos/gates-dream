'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function CashFlowPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/moves/cash-flow"
      icon="💰"
      subtitle="تدفق الأموال في الخزينة والبنك."
      fields={{ dates: 'range', branch: true }}
    />
  );
}
