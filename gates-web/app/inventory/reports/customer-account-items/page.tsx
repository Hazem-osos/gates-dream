'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CustomerAccountItemsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/customer-account-items"
      icon="📦"
      subtitle="حركة العميل بالصنف والكمية وسعر الوحدة، مع التحصيل وقيد اليومية والتسوية، وفي الآخر مدين ودائن ورصيد."
      fields={{
        dates: 'range',
        customer: true,
        item: true,
        branch: true,
        showUnposted: true,
        allAccounts: true,
      }}
    />
  );
}
