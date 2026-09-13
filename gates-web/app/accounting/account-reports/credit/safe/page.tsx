'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function SafePage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/credit/safe"
      icon="💰"
      subtitle="حركة الخزينة خلال الفترة."
      fields={{ dates: 'range', currency: true, branch: true }}
    />
  );
}
