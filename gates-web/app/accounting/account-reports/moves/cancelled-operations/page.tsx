'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function CancelledOperationsPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/moves/cancelled-operations"
      icon="📋"
      subtitle="العمليات الملغاة خلال الفترة."
      fields={{ dates: 'range', branch: true }}
    />
  );
}
