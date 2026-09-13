'use client';

import { CommandCenter, DASH_PANEL } from '@/components/dashboard-primitives';
import CatalogReportPreviewPage from '@/components/report/CatalogReportPreviewPage';

export default function InvoiceVariancePreviewPage() {
  return (
    <CommandCenter
      title="معاينة انحراف الفاتورة"
      module="MFG / REPORTS"
      shortcuts={[
        { key: 'F8', label: 'الفلاتر', href: '/manufacturing/reports/invoice-variance' },
        { key: 'F2', label: 'أمر تشغيل', href: '/manufacturing/operations/operation' },
      ]}
    >
      <div className={DASH_PANEL}>
        <CatalogReportPreviewPage />
      </div>
    </CommandCenter>
  );
}
