'use client';

import { AccountReportFilterPage } from '@/components/report/AccountReportFilters';

export default function CostCenterLedgerPage() {
  return (
    <AccountReportFilterPage
      urlPath="/accounting/account-reports/books/cost-center-ledger"
      icon="📙"
      subtitle="حركة مركز التكلفة المختار وكل مركز مدرج تحته، مع الرصيد الافتتاحي والختامي."
      defaultDatesFromOpenFiscalYear
      fields={{
        dates: 'range',
        costCenter: {
          required: true,
          placeholder: 'اختر مركز التكلفة',
        },
        account: { placeholder: 'كل الحسابات' },
        currency: true,
        level: {
          label: 'المستوى تحت مركز التكلفة',
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
