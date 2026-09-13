'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function TradingAccountPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/analysis/trading-account"
      icon="💹"
      subtitle="نتيجة المتاجرة خلال الفترة."
      fields={{ dates: 'range', branch: true }}
    />
  );
}
