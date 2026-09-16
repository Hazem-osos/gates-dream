export type BrowsePostedStatus = 'all' | 'posted' | 'draft' | 'cancelled';

function collectSearchText(value: unknown, depth = 0): string {
  if (value == null || depth > 2) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLowerCase();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) {
    return value.map((item) => collectSearchText(item, depth + 1)).join(' ');
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => collectSearchText(item, depth + 1))
      .join(' ');
  }
  return '';
}

export function isoDatePart(value: unknown): string {
  if (!value) return '';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function rowMatchesSearch(row: Record<string, unknown>, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return collectSearchText(row).includes(q);
}

export function rowMatchesDateRange(
  row: Record<string, unknown>,
  startDate: string,
  endDate: string,
  dateKeys: string[] = ['date', 'startDate', 'createdAt']
): boolean {
  if (!startDate && !endDate) return true;
  const iso =
    dateKeys.map((key) => isoDatePart(row[key])).find(Boolean) ||
    isoDatePart(row.date) ||
    isoDatePart(row.startDate);
  if (!iso) return true;
  if (startDate && iso < startDate) return false;
  if (endDate && iso > endDate) return false;
  return true;
}

export function rangeOverlaps(
  rowStart: unknown,
  rowEnd: unknown,
  filterStart: string,
  filterEnd: string
): boolean {
  if (!filterStart && !filterEnd) return true;
  const start = isoDatePart(rowStart);
  const end = isoDatePart(rowEnd) || start;
  if (!start) return true;
  if (filterStart && end < filterStart) return false;
  if (filterEnd && start > filterEnd) return false;
  return true;
}

export function rowMatchesPostedStatus(
  row: Record<string, unknown>,
  status: BrowsePostedStatus
): boolean {
  if (status === 'all') return true;
  if (status === 'cancelled') return row.isCancelled === true;
  if (status === 'posted') return row.isPosted === true && row.isCancelled !== true;
  return row.isPosted !== true && row.isCancelled !== true;
}

export function compareBrowseValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), 'ar', {
    numeric: true,
    sensitivity: 'base',
  });
}
