'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function AgedPayablesPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/credit/aged-payables"
      icon="⏳"
      subtitle="أعمار ديون الموردين حتى تاريخ محدد."
      fields={{ dates: 'to', supplier: true, branch: true }}
    />
  );
}
