'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function OverduePaymentsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/overdue-payments"
      icon="⏰"
      subtitle="الدفعات المتأخرة على العملاء."
      fields={{
        dates: 'none',
        customer: true,
        delegate: true,
        warehouse: true,
        itemGroup: true,
        item: true,
        costCenter: true,
        currency: true,
        branch: true,
        minValue: true,
        allAccounts: true,
      }}
    />
  );
}
