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
        journalEntryId: entry.id,
        sourceId: entry.sourceId,
        sourceKind: entry.sourceKind,
        entryType: entry.entryType,
        voucherFund: entry.voucherFund,
        date: entry.date,
        voucherNumber: entry.voucherNumber || entry.legacyGlNum || null,
        description: line?.description || entry.description,
        account: line?.account ?? null,
        costCenter: line?.costCenter ?? null,
        debit: Number(line?.debitBase ?? line?.debit ?? 0),
        credit: Number(line?.creditBase ?? line?.credit ?? 0),
        sourceType: entry.sourceType,
        sourceNumber: entry.sourceNumber,
        isPosted:
          typeof entry.isPosted === 'boolean' ? (entry.isPosted ? 'مرحّل' : 'غير مرحّل') : entry.isPosted,
        isCancelled:
          typeof entry.isCancelled === 'boolean'
            ? entry.isCancelled
              ? 'ملغي'
              : 'غير ملغي'
            : entry.isCancelled,
      });
    }
  }
  return out;
}

function namedEntityLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const name = o.arabicName ?? o.englishName ?? o.name;
  const code = o.serial ?? o.code;
  if (typeof name === 'string' && name.trim()) return name;
  if (typeof code === 'string' && code.trim()) return String(code);
  return null;
}

function flattenNamedObjects(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return {};
  const src = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (value instanceof Date) {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) continue;
    if (key === 'cells' && value && typeof value === 'object') {
      out[key] = value;
      continue;
    }
    const label = namedEntityLabel(value);
    if (label != null) {
      out[key] = label;
      const nestedId = (value as Record<string, unknown>).id;
      const idKey = `${key}Id`;
      if (typeof nestedId === 'string' && nestedId && out[idKey] == null) {
        out[idKey] = nestedId;
      }
      continue;
    }
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      if ('invoiceNumber' in nested) {
        if (typeof nested.id === 'string' && out.invoiceId == null) out.invoiceId = nested.id;
        if (nested.invoiceNumber != null) out.invoiceNumber = nested.invoiceNumber;
        if (nested.date != null && out.date == null) out.date = nested.date;
        if (nested.totalAmount != null && out.totalAmount == null) out.totalAmount = nested.totalAmount;
        if (nested.remainingAmount != null && out.remainingAmount == null) {
          out.remainingAmount = nested.remainingAmount;
        }
        const customer = namedEntityLabel(nested.customer);
        if (customer) out.customer = customer;
        const supplier = namedEntityLabel(nested.supplier);
        if (supplier) out.supplier = supplier;
        continue;
      }
      continue;
    }
    out[key] = value;
  }
  return out;
}

function flattenReportRows(rows: unknown[]): Record<string, unknown>[] {
  return explodeJournalEntryRows(rows).map(flattenNamedObjects);
}

function normalizeRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return flattenReportRows(payload);
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.accounts)) return flattenReportRows(o.accounts);
    if (Array.isArray(o.transactions)) return flattenReportRows(o.transactions);
    if (Array.isArray(o.lines)) return flattenReportRows(o.lines);
    if (Array.isArray(o.parties)) return flattenReportRows(o.parties);
    if (Array.isArray(o.rows)) return flattenReportRows(o.rows);
    if (Array.isArray(o.sections)) return flattenReportRows(o.sections);
    if (Array.isArray(o.receipts) || Array.isArray(o.payments)) {
      const receipts = Array.isArray(o.receipts)
        ? o.receipts.map((row) => ({ type: 'قبض', ...(row as object) }))
        : [];
      const payments = Array.isArray(o.payments)
        ? o.payments.map((row) => ({ type: 'صرف', ...(row as object) }))
        : [];
      return flattenReportRows([...receipts, ...payments]);
    }
    if (Array.isArray(o.receivables) || Array.isArray(o.overdue)) {
      const receivables = Array.isArray(o.receivables)
        ? o.receivables.map((row) => ({ type: 'مستحق', ...(row as object) }))
        : [];
      const overdue = Array.isArray(o.overdue)
        ? o.overdue.map((row) => ({ type: 'متأخر', ...(row as object) }))
        : [];
      return flattenReportRows([...receivables, ...overdue]);
    }
    if ('data' in o && Array.isArray(o.data)) return flattenReportRows(o.data);
    const values = Object.values(o);
    if (
      values.length &&
      values.every((value) => value == null || typeof value !== 'object')
    ) {
      return [o];
    }
  }
  return [];
}

export function extractReportPayload(apiResponse: unknown): {
  rows: Record<string, unknown>[];
  summary: unknown;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
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
        currencyName: inner.currencyName,
        counterpartAccountName: inner.counterpartAccountName,
        costCenterName: inner.costCenterName,
      };
    }
  }

  return { rows, summary, pagination: readReportPagination(root.pagination) };
}

function readReportPagination(value: unknown): { page: number; limit: number; total: number; totalPages: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const page = Number((value as { page?: unknown }).page);
  const limit = Number((value as { limit?: unknown }).limit);
  const total = Number((value as { total?: unknown }).total);
  const totalPages = Number((value as { totalPages?: unknown }).totalPages);
  if (!Number.isFinite(page) || !Number.isFinite(total) || !Number.isFinite(totalPages)) return undefined;
  return {
    page,
    limit: Number.isFinite(limit) ? limit : 0,
    total,
    totalPages,
  };
}
