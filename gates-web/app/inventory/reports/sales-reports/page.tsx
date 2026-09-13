'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function SalesReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/sales-reports"
      icon="🧾"
      subtitle="فواتير المبيعات المرحّلة ضمن الفترة والمرشحات المحددة."
      defaults={{ unpaidOnly: true }}
      fields={{
        dates: 'range',
        profileBaseType: 'SALES_INVOICE',
        customer: true,
        delegate: true,
        seller: true,
        warehouse: true,
        item: true,
        costCenter: true,
        invoiceRange: true,
        currency: true,
        branch: true,
        sortBy: true,
        unpaidOnly: true,
      }}
    />
  );
}
