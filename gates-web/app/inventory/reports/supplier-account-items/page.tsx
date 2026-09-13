'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SupplierAccountItemsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/supplier-account-items"
      icon="📦"
      subtitle="حركة الأصناف لكل مورد خلال الفترة."
      fields={{
        dates: 'range',
        supplier: true,
        item: true,
        branch: true,
        showUnposted: true,
      }}
    />
  );
}
