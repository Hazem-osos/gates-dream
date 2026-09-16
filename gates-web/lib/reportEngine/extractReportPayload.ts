import type { ApiResponse } from '@/lib/api/types';

function isJournalLine(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const line = value as Record<string, unknown>;
  return 'debit' in line || 'credit' in line || 'account' in line;
}

function explodeJournalEntryRows(rows: unknown[]): unknown[] {
  if (!rows.length) return rows;
  const first = rows[0];
  if (!first || typeof first !== 'object') return rows;
  const head = first as Record<string, unknown>;
  const lines = head.lines;
  if (!Array.isArray(lines) || !lines.length || !isJournalLine(lines[0])) return rows;
  if (!('voucherNumber' in head || 'sourceType' in head || 'isPosted' in head)) return rows;

  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const entry = row as Record<string, unknown>;
    const entryLines = Array.isArray(entry.lines) && entry.lines.length ? entry.lines : [null];
    for (const rawLine of entryLines) {
      const line =
        rawLine && typeof rawLine === 'object' ? (rawLine as Record<string, unknown>) : null;
      out.push({
        date: entry.date,
        voucherNumber: entry.voucherNumber,
        description: line?.description || entry.description,
        account: line?.account ?? null,
        costCenter: line?.costCenter ?? null,
        debit: Number(line?.debit ?? 0),
        credit: Number(line?.credit ?? 0),
        sourceType: entry.sourceType,
        sourceNumber: entry.sourceNumber,
        isPosted: entry.isPosted,
        isCancelled: entry.isCancelled,
      });
    }
  }
  return out;
}

function normalizeRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return explodeJournalEntryRows(payload);
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.accounts)) return o.accounts;
    if (Array.isArray(o.transactions)) return o.transactions;
    if (Array.isArray(o.lines)) return o.lines;
    if (Array.isArray(o.parties)) return o.parties;
    if (Array.isArray(o.rows)) return o.rows;
    if (Array.isArray(o.sections)) return o.sections;
    if (Array.isArray(o.receipts) || Array.isArray(o.payments)) {
      const receipts = Array.isArray(o.receipts)
        ? o.receipts.map((row) => ({ type: 'قبض', ...(row as object) }))
        : [];
      const payments = Array.isArray(o.payments)
        ? o.payments.map((row) => ({ type: 'صرف', ...(row as object) }))
        : [];
      return [...receipts, ...payments];
    }
    if ('data' in o && Array.isArray(o.data)) return explodeJournalEntryRows(o.data);
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
