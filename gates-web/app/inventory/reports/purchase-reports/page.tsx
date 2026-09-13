'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function PurchaseReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/purchase-reports"
      icon="🛒"
      subtitle="فواتير المشتريات المرحّلة ضمن الفترة والمرشحات المحددة."
      fields={{
        dates: 'range',
        profileBaseType: 'PURCHASE_INVOICE',
        supplier: true,
        warehouse: true,
        item: true,
        currency: true,
        branch: true,
        unpaidOnly: true,
        allAccounts: true,
      }}
    />
  );
}
