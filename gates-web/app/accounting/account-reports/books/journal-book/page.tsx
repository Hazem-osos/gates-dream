'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function JournalBookPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/books/journal-book"
      icon="📘"
      subtitle="قيود اليومية خلال الفترة، مع الحساب الرئيسي والأستاذ وموقف التأييد والترحيل."
      fields={{
        dates: 'range',
        branch: true,
        account: true,
        costCenter: true,
        currency: true,
        description: true,
        voucherRange: true,
        accountView: true,
        amountCompare: true,
      }}
    />
  );
}
