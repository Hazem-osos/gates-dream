export const MIGRATION_REPORT_DEFAULT_PAGE_SIZE = 1000;
export const MIGRATION_REPORT_MAX_PAGE_SIZE = 1000;

export function normalizeReportPage(page: unknown): number {
  const n = Number(page);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function normalizeReportLimit(limit: unknown): number {
  const n = Number(limit);
  if (!Number.isFinite(n) || n < 1) return MIGRATION_REPORT_DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(n), MIGRATION_REPORT_MAX_PAGE_SIZE);
}

export function paginateSlice<T>(items: readonly T[], page: number, limit: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const skip = (safePage - 1) * limit;
  return {
    items: items.slice(skip, skip + limit),
    total,
    page: safePage,
    limit,
    totalPages,
  };
}

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
