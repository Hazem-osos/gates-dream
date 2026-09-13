/**
 * Pagination Utilities
 * Provides pagination helpers for consistent pagination across the API
 */

export interface PaginationOptions {
  page?: number;
  limit?: number;
  skip?: number;
  take?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
  take?: number;
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor?: string;
  hasNext: boolean;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;
const DEFAULT_PAGE = 1;

/**
 * Normalize pagination options
 */
export function normalizePagination(options: PaginationOptions = {}): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const page = Math.max(1, options.page || DEFAULT_PAGE);
  let limit = options.limit || options.take || DEFAULT_LIMIT;

  // Enforce maximum limit
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  // Ensure limit is positive
  limit = Math.max(1, limit);

  const skip = options.skip !== undefined ? options.skip : (page - 1) * limit;

  return {
    skip: Math.max(0, skip),
    take: limit,
    page,
    limit,
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  options: PaginationOptions = {}
): PaginationResult<T> {
  const { page, limit } = normalizePagination(options);
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}

/**
 * Apply cursor-based pagination
 */
export function applyCursorPagination<T extends { id: string }>(
  data: T[],
  options: CursorPaginationOptions = {}
): CursorPaginationResult<T> {
  const limit = Math.min(options.limit || options.take || DEFAULT_LIMIT, MAX_LIMIT);
  let items = data;

  // If cursor provided, start from that point
  if (options.cursor) {
    const cursorIndex = items.findIndex((item) => item.id === options.cursor);
    if (cursorIndex >= 0) {
      items = items.slice(cursorIndex + 1);
    }
  }

  // Apply limit
  const paginatedItems = items.slice(0, limit);
  const hasNext = items.length > limit;
  const nextCursor = hasNext && paginatedItems.length > 0
    ? paginatedItems[paginatedItems.length - 1].id
    : undefined;

  return {
    data: paginatedItems,
    nextCursor,
    hasNext,
  };
}

/**
 * Extract pagination from query string
 */
export function extractPaginationFromQuery(query: Record<string, string | undefined>): PaginationOptions {
  const page = query.page ? parseInt(query.page, 10) : undefined;
  const limit = query.limit ? parseInt(query.limit, 10) : undefined;
  const skip = query.skip ? parseInt(query.skip, 10) : undefined;
  const take = query.take ? parseInt(query.take, 10) : undefined;

  return {
    page: isNaN(page!) ? undefined : page,
    limit: isNaN(limit!) ? undefined : limit,
    skip: isNaN(skip!) ? undefined : skip,
    take: isNaN(take!) ? undefined : take,
  };
}

