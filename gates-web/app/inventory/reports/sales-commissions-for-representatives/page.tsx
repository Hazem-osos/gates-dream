'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SalesCommissionsForRepresentativesPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/sales-commissions-for-representatives"
      icon="🤝"
      subtitle="عمولات المبيعات للمندوبين خلال الفترة."
      fields={{
        dates: 'range',
        delegate: true,
        itemGroup: true,
      }}
    />
  );
}
