'use client';

import { Suspense } from 'react';
import UniversalReportViewer from '@/components/report/UniversalReportViewer';
import { POS_DAILY_REPORT_COLUMNS } from '@/lib/reportEngine/reportColumns';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { breadcrumbsForReportModule } from '@/lib/reports/reportPageBreadcrumbs';

export default function PosDailyPreviewPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} />}>
      <UniversalReportViewer
        registryPath="pos/daily"
        reportKey="pos-daily"
        title="يومية نقاط البيع"
        exportFileName="pos-daily"
        columnDefs={POS_DAILY_REPORT_COLUMNS}
        breadcrumbs={breadcrumbsForReportModule('pos', 'يومية نقاط البيع')}
      />
    </Suspense>
  );
}
