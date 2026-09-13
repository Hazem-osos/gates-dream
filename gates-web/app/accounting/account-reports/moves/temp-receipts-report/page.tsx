'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function TempReceiptsReportPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/moves/temp-receipts-report"
      icon="🧾"
      subtitle="الإيصالات المؤقتة خلال الفترة."
      fields={{
        dates: 'range',
        costCenter: true,
        branch: true,
      }}
    />
  );
}
