'use client';

import { useState } from 'react';
import { InlineReportResults } from '@/components/report/InlineReportResults';
import { ExtractsReportChrome } from '@/components/extracts/ExtractsReportChrome';

/**
 * Backend `GET /extracts/reports/projects-status` filters by projectId only.
 * Preview still uses the shared InlineReportResults / report catalog path.
 */
export default function ProjectsStatusPage() {
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);

  return (
    <ExtractsReportChrome
      title="تقرير حالة المشاريع"
      onPreview={() => setPreviewQuery({})}
      onReset={() => setPreviewQuery(null)}
      below={previewQuery ? <InlineReportResults urlPath="/extracts/reports/projects-status" query={previewQuery} /> : null}
    >
      <p className="text-sm text-slate-600 sm:col-span-2">
        يعرض موقف المشاريع (نسب وكميات) حسب بيانات المستخلصات المسجّلة.
      </p>
    </ExtractsReportChrome>
  );
}
