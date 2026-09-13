/**
 * Cursor-based Pagination Utilities
 * In-memory helpers plus the Prisma keyset engine.
 */

export {
  paginateWithKeyset,
  paginateWithCursor,
  encodeKeysetCursor,
  decodeKeysetCursor,
  buildKeysetWhere,
  clampKeysetLimit,
  KEYSET_DEFAULT_LIMIT,
  KEYSET_MAX_LIMIT,
} from '../database/paginate-with-keyset';
export type {
  PaginateWithKeysetArgs,
  PaginateWithKeysetResult,
  PaginateWithCursorArgs,
  PaginateWithCursorResult,
  CursorDirection,
  KeysetCursorPayload,
} from '../database/paginate-with-keyset';

export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
  orderBy?: 'asc' | 'desc';
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Create cursor from ID and timestamp
 */
export function createCursor(id: string, timestamp: number): string {
  const data = `${id}:${timestamp}`;
  return Buffer.from(data).toString('base64url');
}

/**
 * Parse cursor to extract ID and timestamp
 */
export function parseCursor(cursor: string): { id: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const [id, timestamp] = decoded.split(':');
    return {
      id,
      timestamp: parseInt(timestamp, 10),
    };
  } catch {
    return null;
  }
}

/**
 * Apply cursor pagination to array
 */
export function applyCursorPagination<T extends { id: string; createdAt: Date }>(
  items: T[],
  options: CursorPaginationOptions = {}
): CursorPaginationResult<T> {
  const limit = options.limit || 50;
  const orderBy = options.orderBy || 'desc';

  // Sort items
  const sorted = [...items].sort((a, b) => {
    const comparison = a.createdAt.getTime() - b.createdAt.getTime();
    return orderBy === 'desc' ? -comparison : comparison;
  });

  // Find start position if cursor provided
  let startIndex = 0;
  if (options.cursor) {
    const parsed = parseCursor(options.cursor);
    if (parsed) {
      startIndex = sorted.findIndex(
        (item) =>
          item.id === parsed.id ||
          (orderBy === 'desc'
            ? item.createdAt.getTime() < parsed.timestamp
            : item.createdAt.getTime() > parsed.timestamp)
      );
      if (startIndex === -1) {
        startIndex = 0;
      }
    }
  }

  // Get page of items
  const pageItems = sorted.slice(startIndex, startIndex + limit + 1);
  const hasMore = pageItems.length > limit;
  const result = hasMore ? pageItems.slice(0, limit) : pageItems;

  // Generate next cursor
  const nextCursor =
    hasMore && result.length > 0
      ? createCursor(
          result[result.length - 1].id,
          result[result.length - 1].createdAt.getTime()
        )
      : undefined;

  return {
    items: result,
    nextCursor,
    hasMore,
  };
}

