'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SalesAndPurchaseTaxPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/sales-and-purchase-tax"
      icon="🧮"
      subtitle="ضريبة المبيعات والمشتريات خلال الفترة."
      fields={{
        dates: 'range',
        currency: true,
        branch: true,
        showUnposted: true,
      }}
    />
  );
}
