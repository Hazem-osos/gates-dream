'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function FinancialPapersPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/credit/financial-papers"
      icon="📜"
      subtitle="أوراق القبض والدفع خلال الفترة."
      fields={{
        dates: 'range',
        account: true,
        costCenter: true,
        currency: true,
        branch: true,
        entity: true,
      }}
    />
  );
}
