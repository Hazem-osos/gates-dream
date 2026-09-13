'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function RepresentativesCommissionsQuantitiesAccountPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/representatives-commissions-quantities-account"
      icon="📊"
      subtitle="حساب عمولات المندوبين بالكميات."
      fields={{
        dates: 'range',
        delegate: true,
        branch: true,
      }}
    />
  );
}
