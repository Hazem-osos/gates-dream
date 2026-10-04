'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function FinancialPositionStatementPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/credit/financial-position-statement"
      icon="📊"
      subtitle="الميزانية في تاريخ محدد."
      fields={{ dates: 'to', costCenter: true, branch: true, compareYear: true }}
    />
  );
}
