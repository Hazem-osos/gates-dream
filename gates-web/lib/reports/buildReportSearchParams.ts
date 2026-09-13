/**
 * Shared query-string builder for report filter → preview navigation.
 */
export type ReportSearchParamInput = Record<string, string | number | boolean | undefined | null>;

export type BuildReportSearchParamsOptions = {
  requireFromTo?: boolean;
};

export function buildReportSearchParams(
  filters: ReportSearchParamInput,
  options: BuildReportSearchParamsOptions = {}
): { params: URLSearchParams; error?: string } {
  const params = new URLSearchParams();
  const fromDate = filters.fromDate != null ? String(filters.fromDate) : '';
  const toDate = filters.toDate != null ? String(filters.toDate) : '';

  if (options.requireFromTo && (!fromDate || !toDate)) {
    return { params, error: 'يرجى اختيار تاريخ البداية والنهاية' };
  }

  for (const [key, raw] of Object.entries(filters)) {
    if (raw === undefined || raw === null || raw === '') continue;
    if (typeof raw === 'boolean') {
      if (raw) params.append(key, 'true');
      continue;
    }
    params.append(key, String(raw));
  }

  return { params };
}

export function reportPreviewHref(
  previewPath: string,
  filters: ReportSearchParamInput,
  options?: BuildReportSearchParamsOptions
): { href: string; error?: string } {
  const { params, error } = buildReportSearchParams(filters, options);
  if (error) return { href: previewPath, error };
  const q = params.toString();
  return { href: q ? `${previewPath}?${q}` : previewPath };
}

export const todayIsoDate = (): string => new Date().toISOString().split('T')[0];
