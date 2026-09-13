'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function ReceivablesAgingPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/receivables-aging"
      icon="⏳"
      subtitle="أعمار ديون العملاء."
      fields={{
        dates: 'to',
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
