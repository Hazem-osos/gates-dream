'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function ReviewBalancePage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/balances/review-balance"
      icon="⚖️"
      subtitle="أرصدة الحسابات خلال الفترة، مع المستوى ومركز التكلفة."
      fields={{
        dates: 'range',
        datesTourId: 'review-balance-to-date',
        account: { tourId: 'review-balance-account-select' },
        costCenter: true,
        currency: true,
        branch: true,
        level: true,
        voucherRange: true,
      }}
    />
  );
}
