'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function JournalBookPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/books/journal-book"
      icon="📘"
      subtitle="قيود اليومية المرحلة خلال الفترة."
      fields={{ dates: 'range', branch: true }}
    />
  );
}
