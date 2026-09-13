'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function OperationsAnalysisPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/analysis/operations-analysis"
      icon="📋"
      subtitle="العمليات المراجعة وغير المراجعة خلال الفترة."
      fields={{ dates: 'range', branch: true }}
    />
  );
}
