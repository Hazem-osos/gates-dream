'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function AgedReceivablesPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/credit/aged-receivables"
      icon="⏳"
      subtitle="أعمار ديون العملاء حتى تاريخ محدد."
      fields={{ dates: 'to', customer: true, branch: true }}
    />
  );
}
