'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function GeneralLedgerPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/books/general-ledger"
      icon="📒"
      subtitle="حركة الحساب وتفاصيل القيود ضمن الفترة."
      fields={{
        dates: 'range',
        account: { placeholder: 'كل الحسابات' },
        branch: true,
        includeDetails: true,
      }}
    />
  );
}
