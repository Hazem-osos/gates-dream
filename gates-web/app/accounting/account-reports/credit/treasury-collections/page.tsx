'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function TreasuryCollectionsPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/credit/treasury-collections"
      icon="💰"
      subtitle="تحصيلات الخزينة لأوراق القبض والدفع."
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
