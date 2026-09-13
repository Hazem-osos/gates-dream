'use client';

import { UnifiedReportFilterCard } from '@/components/report/UnifiedReportFilterCard';
import { ReportFilterPageShell } from '@/components/report/reportFilterFields';
import { getReportByUrlPath } from '@/lib/reports/reportCatalog';
import { breadcrumbsForReportModule } from '@/lib/reports/reportPageBreadcrumbs';

type ReportStubFilterPageProps = {
  urlPath: string;
};

/** Stub inventory reports — unified message until API/filters are ready. */
export function ReportStubFilterPage({ urlPath }: ReportStubFilterPageProps) {
  const entry = getReportByUrlPath(urlPath);
  const title = entry?.titleAr ?? 'تقرير';
  const breadcrumbs = breadcrumbsForReportModule(entry?.module, title);

  return (
    <ReportFilterPageShell
      title={title}
      description="هذا التقرير قيد التفعيل. سيتم ربط الفلاتر ومعاينة البيانات قريباً."
      breadcrumbs={breadcrumbs}
    >
      <UnifiedReportFilterCard
        icon="🚧"
        title={title}
        showTitle={false}
        onPreview={() => {}}
        previewDisabled
      >
        <p className="col-span-full text-sm text-slate-600 dark:text-slate-400 text-right py-4">
          يمكنك استخدام التقارير البديلة من قائمة المخزون حتى اكتمال هذا المسار.
        </p>
      </UnifiedReportFilterCard>
    </ReportFilterPageShell>
  );
}
