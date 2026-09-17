const PREFIX = 'gates_report_cols_v2_';

export function loadReportColumnVisibility(reportKey: string): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${reportKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return null;
  }
}

export function saveReportColumnVisibility(reportKey: string, visibleIds: string[]): void {
  if (typeof window === 'undefined') return;
  if (!visibleIds.length) return;
  try {
    localStorage.setItem(`${PREFIX}${reportKey}`, JSON.stringify(visibleIds));
  } catch {
    /* ignore quota */
  }
}
