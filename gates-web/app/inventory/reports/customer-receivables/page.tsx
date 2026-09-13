'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CustomerReceivablesPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/customer-receivables"
      icon="💳"
      subtitle="مستحقات العملاء خلال الفترة."
      fields={{
        dates: 'range',
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
