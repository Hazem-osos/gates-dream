'use client';

import { Suspense } from 'react';
import UniversalReportViewer from '@/components/report/UniversalReportViewer';
import { SALES_REPORT_COLUMNS } from '@/lib/reportEngine/reportColumns';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { breadcrumbsForReportModule } from '@/lib/reports/reportPageBreadcrumbs';

export default function SalesReportsPreviewPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} />}>
      <UniversalReportViewer
        registryPath="inventory/reports/sales-reports"
        reportKey="inventory-sales"
        title="تقرير المبيعات التفصيلي"
        exportFileName="sales-report"
        columnDefs={SALES_REPORT_COLUMNS}
        breadcrumbs={breadcrumbsForReportModule('inventory', 'تقرير المبيعات التفصيلي')}
      />
    </Suspense>
  );
}
