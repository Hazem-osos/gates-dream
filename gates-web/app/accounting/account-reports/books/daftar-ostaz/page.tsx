'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function DaftarOstazPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/books/daftar-ostaz"
      icon="📄"
      subtitle="حركة الحساب المختار وكل حساب مدرج تحته، مع الرصيد الافتتاحي والختامي."
      defaultDatesFromOpenFiscalYear
      fields={{
        dates: 'range',
        datesTourId: 'daftar-ostaz-date-range',
        account: {
          required: true,
          placeholder: 'اختر الحساب',
          tourId: 'daftar-ostaz-account-select',
        },
        costCenter: true,
        currency: true,
        level: {
          label: 'المستوى تحت الحساب',
          placeholder: 'كل المستويات',
        },
        description: true,
        counterpartAccount: true,
        branch: true,
        reportOptions: ['showUnposted'],
      }}
    />
  );
}
