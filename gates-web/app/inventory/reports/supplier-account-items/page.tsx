'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SupplierAccountItemsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/supplier-account-items"
      icon="📦"
      subtitle="حركة المورد بالصنف والكمية وسعر الوحدة، مع السداد وقيد اليومية والتسوية، وفي الآخر مدين ودائن ورصيد."
      fields={{
        dates: 'range',
        supplier: true,
        item: true,
        branch: true,
        showUnposted: true,
        allAccounts: true,
      }}
    />
  );
}
