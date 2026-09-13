'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function UnpostedOperationsPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/moves/unposted-operations"
      icon="📋"
      subtitle="القيود والعمليات غير المرحلة."
      fields={{ dates: 'range', branch: true }}
    />
  );
}
