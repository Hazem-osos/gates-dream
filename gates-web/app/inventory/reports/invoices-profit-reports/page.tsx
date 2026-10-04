'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function InvoicesProfitReportsPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/invoices-profit-reports"
      icon="🧾"
      subtitle="أرباح كل فاتورة: النوع بعد الرقم، والإضافات والخصومات بعد التكلفة، وثلاث نسب ربح في الآخر."
      fields={{
        dates: 'range',
        customer: true,
        delegate: true,
        invoiceRange: true,
        currency: true,
        branch: true,
        allAccounts: true,
      }}
    />
  );
}
