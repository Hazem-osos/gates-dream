'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function CostCenterLedgerPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/books/cost-center-ledger"
      icon="📙"
      subtitle="حركة حسابات مركز تكلفة خلال الفترة."
      fields={{
        dates: 'range',
        account: true,
        costCenter: true,
        currency: true,
        branch: true,
      }}
    />
  );
}
