/**
 * API Response Types
 * Standard response format from backend API
 */

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    unreadCount?: number;
    hasCriticalUnread?: boolean;
  };
  /** Backend list endpoints often return this alongside `data` */
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    nextCursor?: string | null;
    prevCursor?: string | null;
    hasMore?: boolean;
  };
  items?: T;
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasMore?: boolean;
  /** Report endpoints (e-invoices, POS daily, etc.) */
  summary?: Record<string, unknown>;
}

export interface ApiError {
  status: 'error';
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
}

/**
 * Request configuration
 */
export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, unknown>;
  signal?: AbortSignal;
  timeout?: number;
  /** Skip If-None-Match and force a full 200 body (used after a cache-miss 304). */
  bypassConditionalGet?: boolean;
  /** Do not broadcast to the global error toast / AI explainer (used by diagnose-error). */
  skipErrorNotify?: boolean;
  /** Do not broadcast the global green save toast (background sync, last-rate, favorites). */
  skipSuccessNotify?: boolean;
  /** Overrides the default «تم الحفظ» / «تم الحذف» toast. */
  successMessage?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
  direction?: 'forward' | 'backward';
}

/**
 * Sort parameters
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Filter parameters
 */
export interface FilterParams {
  [key: string]: unknown;
}

/**
 * Query parameters combining pagination, sort, and filters
 */
export interface QueryParams extends PaginationParams, SortParams, FilterParams {}
