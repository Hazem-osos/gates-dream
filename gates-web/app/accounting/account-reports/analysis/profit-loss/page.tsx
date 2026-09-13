'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function ProfitLossPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/analysis/profit-loss"
      icon="📊"
      subtitle="حساب الأرباح والخسائر لنفس قائمة الدخل."
      fields={{ dates: 'range', branch: true }}
    />
  );
}
