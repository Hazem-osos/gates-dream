'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function CollectionsAndOverduesPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/collections-and-overdues"
      icon="💰"
      subtitle="حتى تاريخ محدد: المستحق لسه ما جاش وقته، والمتأخر جه وقته ولسه ما اتحصّلش، والتحصيلات أي تحصيل تم."
      fields={{ dates: 'to', customer: true, branch: true, allAccounts: true }}
    />
  );
}
