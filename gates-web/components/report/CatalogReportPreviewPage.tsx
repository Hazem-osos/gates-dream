'use client';

import { usePathname } from 'next/navigation';
import { UniversalReportViewer } from '@/components/report/UniversalReportViewer';
import { getReportByUrlPath } from '@/lib/reports/reportCatalog';
import { breadcrumbsForReportModule } from '@/lib/reports/reportPageBreadcrumbs';

/**
 * Default export for report preview routes: resolves catalog entry from current pathname.
 */
export default function CatalogReportPreviewPage() {
  const pathname = usePathname() ?? '';
  const entry = getReportByUrlPath(pathname);

  if (!entry || entry.kind !== 'preview') {
    return (
      <div className="p-8 text-center text-slate-600" dir="rtl">
        <p className="font-semibold">تعذّر تحميل التقرير</p>
        <p className="text-sm mt-2">لم يُعثر على إعدادات المعاينة لهذا المسار.</p>
      </div>
    );
  }

  const registryPath = entry.registryPath;

  return (
    <UniversalReportViewer
      registryPath={registryPath}
      reportKey={entry.reportKey}
      title={entry.titleAr}
      exportFileName={entry.reportKey}
      breadcrumbs={breadcrumbsForReportModule(entry.module, entry.titleAr)}
    />
  );
}
