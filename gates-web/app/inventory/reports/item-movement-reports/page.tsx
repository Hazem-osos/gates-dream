'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function ItemMovementReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/item-movement-reports"
      icon="📦"
      subtitle="حركة الأصناف خلال الفترة: الوارد والصادر والرصيد، باسم الصنف والمخزن."
      fields={{
        dates: 'range',
        warehouse: true,
        warehouseScope: 'all',
        item: true,
        itemGroup: true,
        customer: true,
        supplier: true,
        delegate: true,
        costCenter: true,
        currency: true,
        branch: true,
        invoiceRange: true,
        allAccounts: true,
        reportOptions: true,
        groupByLayout: true,
      }}
    />
  );
}
