'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function DetailedInvoiceMovementPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/detailed-invoice-movement"
      icon="📑"
      subtitle="تفاصيل حركة الفواتير سطراً بسطر."
      fields={{
        dates: 'range',
        customer: true,
        supplier: true,
        delegate: true,
        warehouse: true,
        itemGroup: true,
        item: true,
        costCenter: true,
        invoiceRange: true,
        currency: true,
        branch: true,
        unpaidOnly: true,
        allAccounts: true,
      }}
    />
  );
}
