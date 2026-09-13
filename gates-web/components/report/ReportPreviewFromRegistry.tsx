'use client';

import { UniversalReportViewer } from '@/components/report/UniversalReportViewer';
import { previewTitleFromPath } from '@/lib/reportPreview/resolveReportEndpoint';

/** @deprecated Prefer {@link UniversalReportViewer} with explicit reportKey/title. */
export default function ReportPreviewFromRegistry({ path }: { path: string }) {
  const title = previewTitleFromPath(path).replace(/^معاينة — /, '') || 'تقرير';
  const reportKey = path.replace(/\//g, '-');

  return (
    <UniversalReportViewer
      registryPath={path}
      reportKey={reportKey}
      title={title}
      exportFileName={reportKey}
    />
  );
}
