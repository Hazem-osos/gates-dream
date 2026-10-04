'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SlowMovingReportPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/slow-moving"
      icon="🐢"
      subtitle="أصناف لها رصيد ولم تتحرك منذ بداية الفترة. بدون تاريخ تُحسب تسعون يوماً."
      fields={{ dates: 'range', warehouse: true, item: true, branch: true }}
    />
  );
}
