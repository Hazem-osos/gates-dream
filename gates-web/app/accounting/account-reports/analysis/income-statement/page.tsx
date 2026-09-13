'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function IncomeStatementPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/analysis/income-statement"
      icon="📑"
      subtitle="الإيرادات والمصروفات وصافي الربح خلال الفترة."
      fields={{ dates: 'range', branch: true }}
    />
  );
}
