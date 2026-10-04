'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function OverduePaymentsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/overdue-payments"
      icon="⏰"
      subtitle="دفعات فواتير المبيعات والمشتريات خلال الفترة، مع حالة السداد وأيام التأخير."
      fields={{
        dates: 'range',
        customer: true,
        supplier: true,
        delegate: true,
        warehouse: true,
        itemGroup: true,
        item: true,
        costCenter: true,
        branch: true,
        invoiceRange: true,
        debtSchedule: true,
      }}
    />
  );
}
