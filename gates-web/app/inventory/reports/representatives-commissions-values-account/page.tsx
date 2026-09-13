'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function RepresentativesCommissionsValuesAccountPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/representatives-commissions-values-account"
      icon="💵"
      subtitle="حساب عمولات المندوبين بالقيم."
      fields={{
        dates: 'range',
        customer: true,
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
