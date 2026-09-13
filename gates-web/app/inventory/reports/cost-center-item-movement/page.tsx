'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CostCenterItemMovementPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/cost-center-item-movement"
      icon="🏷️"
      subtitle="حركة الأصناف حسب مركز التكلفة."
      fields={{
        dates: 'range',
        delegate: true,
        warehouse: true,
        itemGroup: true,
        item: true,
        costCenter: true,
        branch: true,
      }}
    />
  );
}
