import { fetchApiQuery } from '@/lib/api/query-fetch';
import type { QueryParams } from '@/lib/api/types';

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

/** Walks a paginated list until every row is loaded. The API caps one page at 1000. */
export async function fetchAllPages<T>(
  url: string,
  params: QueryParams | undefined,
  signal?: AbortSignal
): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await fetchApiQuery<T[]>(
      url,
      { ...params, page, limit: PAGE_SIZE },
      signal
    );
    const batch = Array.isArray(res.data) ? res.data : [];
    rows.push(...batch);
    totalPages = res.pagination?.totalPages ?? 1;
    if (batch.length === 0) break;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);
  return rows;
}
