'use client';

import { InventoryReportFilterPage } from '@/components/report/InventoryReportFilters';

export default function PartyAnalyticalPositionPage() {
  return (
    <InventoryReportFilterPage
      urlPath="/inventory/reports/party-analytical-position"
      icon="📊"
      subtitle="ملخص حركة كل عميل أو مورد في الفترة: مبيعات، تحصيلات، مشتريات، رصيد، وأوراق غير محصلة."
      fields={{
        dates: 'range',
        customer: true,
        supplier: true,
        delegate: true,
        area: true,
        costCenter: true,
        currency: true,
        branch: true,
        allAccounts: true,
      }}
    />
  );
}
