'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function ReceivablesAgingPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/receivables-aging"
      icon="⏳"
      subtitle="أعمار ديون العملاء والموردين حتى التاريخ، مع فلتر من/إلى لعمر الدين بالنسبة للفاتورة ولآخر سداد."
      fields={{
        dates: 'to',
        customer: true,
        supplier: true,
        delegate: true,
        warehouse: true,
        itemGroup: true,
        item: true,
        costCenter: true,
        currency: true,
        branch: true,
        minValue: true,
        debtAgeRanges: true,
        allAccounts: true,
      }}
    />
  );
}
