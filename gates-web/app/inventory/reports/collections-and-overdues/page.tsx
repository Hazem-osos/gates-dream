'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CollectionsAndOverduesPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/collections-and-overdues"
      icon="💰"
      subtitle="تحصيلات العملاء والمتأخرات حتى تاريخ محدد."
      fields={{ dates: 'to', customer: true }}
    />
  );
}
