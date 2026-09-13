'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function DaftarOstazPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/books/daftar-ostaz"
      icon="📄"
      subtitle="حركة حساب محدد مع رصيد افتتاحي وختامي."
      fields={{
        dates: 'range',
        datesTourId: 'daftar-ostaz-date-range',
        account: {
          required: true,
          placeholder: 'اختر الحساب',
          tourId: 'daftar-ostaz-account-select',
        },
        branch: true,
      }}
    />
  );
}
