'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CustomerReceivablesPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/customer-receivables"
      icon="💳"
      subtitle="مستحقات العملاء حتى تاريخ النهاية: سابق أو متأخرات لما استحق قبل بداية الفترة، ولم تستحق، ودفعات وشيكات لأعمار 30 و60 و90 وما أكبر."
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
