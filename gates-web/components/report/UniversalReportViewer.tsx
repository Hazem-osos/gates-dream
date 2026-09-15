'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApiQuery } from '@/lib/hooks/useApi';
import type { QueryParams } from '@/lib/api/types';
import {
  resolveReportApiPath,
  mapReportPreviewQueryParams,
  ensureReportPreviewDates,
  reportPreviewNeedsDateRange,
} from '@/lib/reportPreview/resolveReportEndpoint';
import { extractReportPayload } from '@/lib/reportEngine/extractReportPayload';
import { buildReportFilterBadges } from '@/lib/reportEngine/reportFilterBadges';
import { UniversalReportView } from '@/components/report/UniversalReportView';
import type { ReportColumnDef } from '@/lib/reportEngine/reportColumns';
import type { ReportBreadcrumb } from '@/lib/reports/reportPageBreadcrumbs';

const PARAM_KEYS = [
  'page',
  'limit',
  'fromDate',
  'toDate',
  'stageId',
  'semesterId',
  'branchId',
  'studentId',
  'customerId',
  'supplierId',
  'customerCategoryId',
  'supplierCategoryId',
  'accountId',
  'costCenterId',
  'includeDetails',
  'includeSummary',
  'asOfDate',
  'currencyId',
  'itemId',
  'representativeId',
  'warehouseId',
  'delegateId',
  // Wave 5 fix: the sales-report filter page has always put these on the
  // preview URL, but this whitelist silently dropped them before the
  // request ever reached the API.
  'sellerId',
  'sortBy',
  'unpaidOnly',
  'fromInvoice',
  'toInvoice',
  'level',
  'fromVoucher',
  'toVoucher',
  'startDate',
  'endDate',
  'profileId',
  'itemGroupId',
  'serial',
  'allAccounts',
  'totalReport',
  'showUnposted',
  'minValue',
];

export type UniversalReportViewerProps = {
  registryPath: string;
  reportKey: string;
  title: string;
  columnDefs?: ReportColumnDef[];
  exportFileName?: string;
  breadcrumbs?: ReportBreadcrumb[];
};

/**
 * Fetches report data from the registry API path and renders {@link UniversalReportView}.
 */
export function UniversalReportViewer({
  registryPath,
  reportKey,
  title,
  columnDefs,
  exportFileName,
  breadcrumbs,
}: UniversalReportViewerProps) {
  const searchParams = useSearchParams();
  // Static preview pages hydrate with empty searchParams first. Fetching in
  // that window hits GET /sales without dates → 400 English → generic toast.
  const [paramsReady, setParamsReady] = useState(false);
  useEffect(() => setParamsReady(true), []);

  const rawParams = useMemo(() => {
    const o: Record<string, string> = {};
    for (const key of PARAM_KEYS) {
      const v = searchParams.get(key);
      if (v !== null && v !== '') o[key] = v;
    }
    return o;
  }, [searchParams]);

  const params = useMemo(
    () =>
      ensureReportPreviewDates(
        mapReportPreviewQueryParams(rawParams, registryPath),
        registryPath
      ),
    [rawParams, registryPath]
  );

  const endpoint = useMemo(
    () => resolveReportApiPath(registryPath, rawParams),
    [registryPath, rawParams]
  );

  const datesReady =
    !reportPreviewNeedsDateRange(registryPath) ||
    Boolean(params.fromDate && params.toDate);

  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  const { data, isLoading, isError, error } = useApiQuery<unknown>(
    ['report-preview', registryPath, paramsKey],
    endpoint ?? '/__noop__',
    params as QueryParams,
    { enabled: paramsReady && Boolean(endpoint) && datesReady }
  );

  const { rows, summary } = useMemo(() => {
    if (!endpoint || !data) return { rows: [], summary: undefined };
    return extractReportPayload(data);
  }, [data, endpoint]);

  const filterBadges = useMemo(() => buildReportFilterBadges(rawParams), [rawParams]);

  if (!endpoint) {
    return (
      <UniversalReportView
        title={title}
        reportKey={reportKey}
        registryPath={registryPath}
        rows={[]}
        filterBadges={filterBadges}
        isError
        errorMessage="لا يوجد مسار API لهذا التقرير في الخادم حالياً."
        columnDefs={columnDefs}
        breadcrumbs={breadcrumbs}
      />
    );
  }

  return (
    <UniversalReportView
      title={title}
      reportKey={reportKey}
      registryPath={registryPath}
      rows={rows}
      summary={summary}
      filterBadges={filterBadges}
      isLoading={isLoading || !paramsReady}
      isError={isError}
      errorMessage={error?.message}
      exportFileName={exportFileName}
      columnDefs={columnDefs}
      breadcrumbs={breadcrumbs}
    />
  );
}

export default UniversalReportViewer;
