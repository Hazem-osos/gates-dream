'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function ItemMovementReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/item-movement-reports"
      icon="📦"
      subtitle="حركة مخزنية تفصيلية للأصناف ضمن الفترة."
      fields={{
        dates: 'range',
        warehouse: true,
        item: true,
        customer: true,
        supplier: true,
        delegate: true,
        costCenter: true,
        serial: true,
        currency: true,
        branch: true,
        allAccounts: true,
        totalReport: true,
      }}
    />
  );
}
