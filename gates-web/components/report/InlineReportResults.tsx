'use client';

import { useEffect } from 'react';
import { UniversalReportViewer } from '@/components/report/UniversalReportViewer';
import { getReportByUrlPath } from '@/lib/reports/reportCatalog';

export function InlineReportResults({
  urlPath,
  query,
  registryPath,
  reportKey,
  title,
}: {
  urlPath: string;
  query: Record<string, string> | null;
  registryPath?: string;
  reportKey?: string;
  title?: string;
}) {
  const entry = getReportByUrlPath(urlPath);
  const path = registryPath ?? entry?.registryPath;
  const key = reportKey ?? entry?.reportKey ?? path?.replace(/\//g, '-') ?? 'report';
  const heading = title ?? entry?.titleAr ?? 'تقرير';

  useEffect(() => {
    if (!query || !path) return;
    document.getElementById('report-inline-results')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [query, path]);

  if (!query || !path) return null;

  return (
    <div id="report-inline-results">
      <UniversalReportViewer
        embedded
        queryOverride={query}
        registryPath={path}
        reportKey={key}
        title={heading}
        exportFileName={key}
      />
    </div>
  );
}
