'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function ExpensesAnalysisPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/analysis/expenses-analysis"
      icon="📉"
      subtitle="تحليل المصروفات المؤيدة وغير المؤيدة."
      fields={{
        dates: 'range',
        account: true,
        costCenter: true,
        currency: true,
        branch: true,
      }}
    />
  );
}
