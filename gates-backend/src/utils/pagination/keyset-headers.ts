import type { Request, Response } from 'express';
import { isKeysetListRequest, type CursorDirection } from './keysetPagination';

export function wantsKeysetPagination(req: Pick<Request, 'query' | 'headers'>): boolean {
  const q = req.query ?? {};
  if (isKeysetListRequest({
    cursor: typeof q.cursor === 'string' ? q.cursor : undefined,
    direction: q.direction === 'forward' || q.direction === 'backward' ? q.direction : undefined,
  })) {
    return true;
  }
  const header = String(req.headers?.['x-pagination'] ?? '').toLowerCase();
  return header === 'cursor' || header === 'keyset';
}

/** Query `direction`, or `forward` when the client asked for keyset via header. */
export function keysetDirectionFromRequest(
  req: Pick<Request, 'query' | 'headers'>
): CursorDirection | undefined {
  const q = req.query ?? {};
  if (q.direction === 'forward' || q.direction === 'backward') return q.direction;
  return wantsKeysetPagination(req) ? 'forward' : undefined;
}

export function setKeysetPaginationHeaders(
  res: Response,
  page: {
    nextCursor?: string | null;
    prevCursor?: string | null;
    hasMore?: boolean;
  }
): void {
  if (page.nextCursor) res.setHeader('X-Next-Cursor', page.nextCursor);
  if (page.prevCursor) res.setHeader('X-Prev-Cursor', page.prevCursor);
  if (page.hasMore !== undefined) res.setHeader('X-Has-More', page.hasMore ? '1' : '0');
}
