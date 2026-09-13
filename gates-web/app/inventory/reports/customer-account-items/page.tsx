'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CustomerAccountItemsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/customer-account-items"
      icon="📦"
      subtitle="حركة الأصناف لكل عميل ضمن الفترة المحددة."
      fields={{
        dates: 'range',
        customer: true,
        showUnposted: true,
      }}
    />
  );
}
