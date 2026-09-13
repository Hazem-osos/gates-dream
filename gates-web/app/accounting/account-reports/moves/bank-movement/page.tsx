'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function BankMovementPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/moves/bank-movement"
      icon="🏦"
      subtitle="كشف حركة حساب البنك خلال الفترة."
      fields={{
        dates: 'range',
        account: true,
        currency: true,
        branch: true,
      }}
    />
  );
}
