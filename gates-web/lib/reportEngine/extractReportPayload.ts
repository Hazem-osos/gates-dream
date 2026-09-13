import type { ApiResponse } from '@/lib/api/types';

function normalizeRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.accounts)) return o.accounts;
    if (Array.isArray(o.transactions)) return o.transactions;
    if (Array.isArray(o.lines)) return o.lines;
    if (Array.isArray(o.rows)) return o.rows;
    if (Array.isArray(o.sections)) return o.sections;
    if ('data' in o && Array.isArray(o.data)) return o.data as unknown[];
  }
  return [];
}

export function extractReportPayload(apiResponse: unknown): {
  rows: Record<string, unknown>[];
  summary: unknown;
} {
  if (!apiResponse || typeof apiResponse !== 'object') {
    return { rows: [], summary: undefined };
  }
  const root = apiResponse as ApiResponse<unknown> & Record<string, unknown>;
  let summary: unknown = root.summary;
  const rows = normalizeRows(root.data) as Record<string, unknown>[];

  // Some report payloads (e.g. income-statement/balance-sheet) nest
  // `summary` one level inside `data` alongside the row array (`data.lines`),
  // instead of as a sibling of `data`. Previously this fallback only ran
  // when `rows` came back empty, so any report shaped like
  // `{ data: { lines: [...], summary: {...} } }` had its summary silently
  // dropped even though rows rendered fine — the metric cards never showed.
  if (
    summary == null &&
    root.data &&
    typeof root.data === 'object' &&
    !Array.isArray(root.data)
  ) {
    const inner = root.data as Record<string, unknown>;
    if (inner.summary != null) summary = inner.summary;
    else if (inner.openingBalance != null || inner.closingBalance != null) {
      summary = {
        openingBalance: inner.openingBalance,
        closingBalance: inner.closingBalance,
        account: inner.account,
      };
    }
  }

  return { rows, summary };
}
