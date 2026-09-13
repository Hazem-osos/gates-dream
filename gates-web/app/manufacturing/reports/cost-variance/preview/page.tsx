'use client';

import { CommandCenter, DASH_PANEL } from '@/components/dashboard-primitives';
import CatalogReportPreviewPage from '@/components/report/CatalogReportPreviewPage';

export default function CostVariancePreviewPage() {
  return (
    <CommandCenter
      title="معاينة انحراف التكلفة"
      module="MFG / REPORTS"
      shortcuts={[
        { key: 'F8', label: 'الفلاتر', href: '/manufacturing/reports/cost-variance' },
        { key: 'F2', label: 'أمر تشغيل', href: '/manufacturing/operations/operation' },
      ]}
    >
      <div className={DASH_PANEL}>
        <CatalogReportPreviewPage />
      </div>
    </CommandCenter>
  );
}
