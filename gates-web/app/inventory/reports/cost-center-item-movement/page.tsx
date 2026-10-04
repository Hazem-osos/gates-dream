'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CostCenterItemMovementPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/cost-center-item-movement"
      icon="🏷️"
      subtitle="حركة الأصناف على مراكز التكلفة: المدخلات والمخرجات والرصيد، مثل حركة الأصناف."
      fields={{
        dates: 'range',
        delegate: true,
        warehouse: true,
        itemGroup: true,
        item: true,
        costCenter: true,
        branch: true,
        reportOptions: true,
        groupByLayout: true,
      }}
    />
  );
}
