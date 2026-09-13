'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function FinancialPositionStatementPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/credit/financial-position-statement"
      icon="📊"
      subtitle="المركز المالي في تاريخ محدد."
      fields={{ dates: 'to', branch: true }}
    />
  );
}
