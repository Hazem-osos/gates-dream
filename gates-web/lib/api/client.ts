/**
 * Centralized API Client
 * Handles all API requests with authentication, error handling, and retry logic
 */

import { ApiResponse, ApiError, RequestConfig, QueryParams } from './types';
import { AUTH_TOKEN_COOKIE_NAME } from '../auth/constants';
import { isAuthEnforced, redirectToLogin } from '../auth/auth-mode';
import { syncAuthTokenCookie } from '../auth/sync-session-cookie';
import { buildTenantRequestHeaders, getTenantContext } from '../tenant/tenant-context-storage';
import {
  buildConditionalGetKey,
  bodyForNotModified,
  peekConditionalGetEtag,
  rememberConditionalGet,
} from './conditional-get-cache';
import {
  rememberAuthUserSub,
  readRememberedAuthUserSub,
  resetAuthSessionStorage,
} from '../auth/reset-auth-session';
import { jwtSubject } from '../auth/jwt-client';
import {
  localizeApiErrorMessage,
  notifyApiError,
  shouldBroadcastApiError,
} from './api-error-notify';
import {
  DEFAULT_DELETE_SUCCESS_MESSAGE,
  DEFAULT_SAVE_SUCCESS_MESSAGE,
  queueApiSuccessToast,
} from './api-success-notify';
import { formatApiErrorMessage } from './format-api-error';
import {
  isAbortError,
  asAbortError,
  isRateLimitError,
} from './isAbortError';

export {
  isAbortError,
  isAbortLikeError,
  asAbortError,
  isRateLimitError,
  isNotModifiedError,
  isSoftQueryFailure,
} from './isAbortError';

// Prefer explicit backend URL via NEXT_PUBLIC_API_URL.
// Otherwise the browser uses same-origin `/api/v1` (rewritten to BACKEND_PROXY_TARGET),
// including local `next start` so production mode still talks to the backend.
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/v1`;
  }
  const internal = (process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
  return `${internal}/api/v1`;
}

// Type guard to safely detect ApiError shape
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as ApiError).status === 'error' &&
    'code' in error
  );
}
const DEFAULT_TIMEOUT = 30000; // 30 seconds

function linkAbortSignal(controller: AbortController, source: AbortSignal): () => void {
  if (source.aborted) {
    controller.abort(source.reason);
    return () => {};
  }
  const onAbort = () => {
    try {
      controller.abort(source.reason);
    } catch {
      controller.abort();
    }
  };
  source.addEventListener('abort', onAbort, { once: true });
  return () => source.removeEventListener('abort', onAbort);
}

function buildRequestSignal(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const cleanups: (() => void)[] = [];

  if (external) {
    cleanups.push(linkAbortSignal(controller, external));
  }

  const timeoutId = setTimeout(() => {
    if (controller.signal.aborted) return;
    try {
      controller.abort(new DOMException('Request timed out', 'TimeoutError'));
    } catch {
      controller.abort();
    }
  }, timeoutMs);

  controller.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(timeoutId);
      for (const off of cleanups) off();
    },
    { once: true }
  );

  return controller.signal;
}

function normalizeFetchFailure(error: unknown): Error {
  if (isAbortError(error)) {
    const isTimeout =
      (error instanceof DOMException && error.name === 'TimeoutError') ||
      (error instanceof Error &&
        (error.name === 'TimeoutError' || error.message.toLowerCase().includes('timed out')));
    if (isTimeout) {
      return new Error('Request timeout');
    }
    return asAbortError(error);
  }
  if (error instanceof Error) {
    if (error.message === 'Failed to fetch') {
      return new Error(
        'Failed to fetch. Is the API running? Check NEXT_PUBLIC_API_URL and CORS (same host as FRONTEND_URL on the backend).'
      );
    }
    return error;
  }
  return new Error('Unknown error occurred');
}

class ApiClient {
  private defaultHeaders: Record<string, string>;

  /**
   * Optional fixed base URL (tests). Otherwise base URL is resolved per request so the browser
   * always uses `window.location.origin` after hydration (module-level resolution can run too early).
   */
  constructor(private readonly baseUrlOverride?: string) {
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private resolveBaseURL(): string {
    if (this.baseUrlOverride) return this.baseUrlOverride.replace(/\/$/, '');
    return resolveApiBaseUrl();
  }

  /**
   * Read token from document cookie (fallback if storage was cleared or another tab set cookie only)
   */
  private getAuthTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const prefix = `${AUTH_TOKEN_COOKIE_NAME}=`;
    const segment = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(prefix));
    if (!segment) return null;
    try {
      return decodeURIComponent(segment.slice(prefix.length));
    } catch {
      return segment.slice(prefix.length) || null;
    }
  }

  /**
   * Get authentication token from storage (and cookie fallback for Edge-middleware alignment)
   */
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;

    return (
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token') ||
      this.getAuthTokenFromCookie()
    );
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string | null, persist: boolean = true): void {
    if (typeof window === 'undefined') return;

    if (token) {
      const nextSub = jwtSubject(token);
      const prevSub = readRememberedAuthUserSub();
      if (prevSub && nextSub && prevSub !== nextSub) {
        resetAuthSessionStorage();
      }
      rememberAuthUserSub(nextSub);
      if (persist) {
        localStorage.setItem('auth_token', token);
        sessionStorage.removeItem('auth_token');
      } else {
        sessionStorage.setItem('auth_token', token);
        localStorage.removeItem('auth_token');
      }
      syncAuthTokenCookie(token, persist);
    } else {
      resetAuthSessionStorage();
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
      syncAuthTokenCookie(null, persist);
    }
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.setAuthToken(null);
  }

  /** Keep Edge middleware cookie aligned with the stored JWT. */
  ensureAuthCookie(): void {
    if (typeof window === 'undefined') return;
    const token = this.getAuthToken();
    if (!token) return;
    syncAuthTokenCookie(token, Boolean(localStorage.getItem('auth_token')));
  }

  /**
   * Build query string from params
   */
  private buildQueryString(params?: QueryParams): string {
    if (!params || Object.keys(params).length === 0) return '';

    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else if (typeof value === 'object') {
          searchParams.append(key, JSON.stringify(value));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Handle response
   */
  private async handleResponse<T>(
    response: Response,
    cacheKey?: string,
    skipAuthExpire = false
  ): Promise<ApiResponse<T>> {
    if (response.status === 304) {
      const cached = bodyForNotModified<T>(cacheKey);
      if (cached) return cached;
      throw Object.assign(new Error('HTTP 304: Not Modified'), {
        status: 'error' as const,
        code: '304',
      }) as Error & ApiError;
    }

    const contentType = response.headers.get('content-type') || '';

    let data: unknown;
    try {
      const text = await response.text();
      const trimmed = text.trim().replace(/^\uFEFF/, '');
      const treatAsJson =
        contentType.includes('application/json') ||
        contentType.includes('+json') ||
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'));

      if (treatAsJson && trimmed.length > 0) {
        try {
          data = JSON.parse(trimmed);
          // Double-encoded JSON body: "{\"status\":\"success\",...}"
          let depth = 0;
          while (typeof data === 'string' && depth < 3) {
            const inner = data.trim().replace(/^\uFEFF/, '');
            if (!inner.startsWith('{') && !inner.startsWith('[')) break;
            try {
              data = JSON.parse(inner);
              depth += 1;
            } catch {
              break;
            }
          }
        } catch {
          data = text;
        }
      } else {
        data = text;
      }
    } catch {
      throw new Error('Failed to parse response');
    }

    const bodyRecord =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : null;

    if (!response.ok) {
      const message =
        (typeof bodyRecord?.message === 'string' ? bodyRecord.message : null) ||
        `HTTP ${response.status}: ${response.statusText}`;
      const code =
        (typeof bodyRecord?.code === 'string' ? bodyRecord.code : null) ||
        String(response.status);
      const displayMessage = localizeApiErrorMessage(message, response.status);
      const err = Object.assign(new Error(displayMessage), {
        status: 'error' as const,
        errors: bodyRecord?.errors as ApiError['errors'] | Array<{ path?: string; message?: string }> | undefined,
        code,
      }) as Error & ApiError;
      err.message = formatApiErrorMessage(err);

      if (response.status === 401 && !skipAuthExpire) {
        this.clearAuthToken();
        if (isAuthEnforced()) {
          redirectToLogin();
        }
      }

      throw err;
    }

    const parsed = data as ApiResponse<T>;
    if (cacheKey) {
      const etag = response.headers.get('ETag');
      if (etag) rememberConditionalGet(cacheKey, etag, parsed);
    }
    return parsed;
  }

  /**
   * Make request with retry logic
   */
  private broadcastSuccess(url: string, config: RequestConfig, data?: ApiResponse<unknown>): void {
    if (config.skipSuccessNotify) return;
    const method = config.method;
    if (!method || method === 'GET') return;
    if (isSilentSuccessUrl(url)) return;
    const fromBody =
      typeof data?.message === 'string' && /[\u0600-\u06FF]/.test(data.message)
        ? data.message.trim()
        : '';
    const message =
      config.successMessage?.trim() ||
      fromBody ||
      (method === 'DELETE' ? DEFAULT_DELETE_SUCCESS_MESSAGE : DEFAULT_SAVE_SUCCESS_MESSAGE);
    queueApiSuccessToast(message);
  }

  private broadcastFinalError(error: unknown, url?: string): void {
    if (isAbortError(error) || isRateLimitError(error)) return;
    if (!isApiError(error)) return;
    const httpStatus = Number.parseInt(error.code ?? '', 10);
    if (Number.isNaN(httpStatus) || !shouldBroadcastApiError(httpStatus)) return;
    const rawMessage = (error.message ?? '').toLowerCase();
    if (
      httpStatus === 404 ||
      error.code === 'DOCUMENT_OCCUPIED' ||
      rawMessage === 'journal entry not found' ||
      rawMessage === 'error getting journal entry' ||
      rawMessage === 'failed to get journal entry' ||
      rawMessage === 'القيد غير موجود' ||
      (error.message ?? '').includes('السند مفتوح حالياً عند')
    ) {
      return;
    }
    notifyApiError({
      message: localizeApiErrorMessage(error.message, httpStatus),
      httpStatus,
      code: error.code,
      url,
    });
  }

  private async requestWithRetry<T>(
    url: string,
    config: RequestConfig,
    retries: number = 1
  ): Promise<ApiResponse<T>> {
    let lastError: Error | ApiError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.request<T>(url, config);
        this.broadcastSuccess(url, config, response);
        return response;
      } catch (error) {
        lastError = error as Error | ApiError;

        if (isAbortError(error)) {
          throw asAbortError(error);
        }

        if (isRateLimitError(error)) {
          throw error;
        }

        const skipNotify = config.skipErrorNotify === true;

        // Don't retry on 4xx errors
        if (isApiError(error)) {
          const code = error.code;
          if (code && code.startsWith('4')) {
            if (!skipNotify) this.broadcastFinalError(error, url);
            throw error;
          }
        }

        // Don't retry on last attempt
        if (attempt === retries) {
          if (!skipNotify) this.broadcastFinalError(error, url);
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!config.skipErrorNotify) this.broadcastFinalError(lastError, url);
    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Tenant headers must match the JWT company. Skip on auth/profile bootstrap paths
   * so a stale X-Company-Id from a previous session cannot skew /users/me.
   */
  private shouldAttachTenantHeaders(url: string): boolean {
    const path = url.split('?')[0] ?? url;
    if (path === '/users/me' || path.startsWith('/users/me/')) return false;
    if (path.startsWith('/auth/')) return false;
    if (path === '/onboarding/status') return false;
    if (path.startsWith('/onboarding/')) return true;
    return true;
  }

  /**
   * Make HTTP request
   */
  private async request<T>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      params,
      signal,
      timeout = DEFAULT_TIMEOUT,
      bypassConditionalGet = false,
    } = config;

    // Build full URL (resolve base each request — avoids wrong host when module loaded before `window`)
    const queryString = params ? this.buildQueryString(params) : '';
    const fullURL = `${this.resolveBaseURL()}${url}${queryString}`;

    // Get auth token
    const token = this.getAuthToken();
    const authHeaders: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    // CSRF protection: read XSRF-TOKEN cookie and send X-CSRF-Token header
    const csrfHeaders: Record<string, string> = {};
    if (typeof document !== 'undefined' && method !== 'GET') {
      const match = document.cookie
        ?.split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('XSRF-TOKEN='));
      if (match) {
        const value = decodeURIComponent(match.split('=')[1] || '');
        if (value) {
          csrfHeaders['X-CSRF-Token'] = value;
        }
      }
    }

    const tenantHeaders = this.shouldAttachTenantHeaders(url)
      ? buildTenantRequestHeaders(method, true)
      : {};

    const cacheKey =
      method === 'GET'
        ? buildConditionalGetKey(method, fullURL, getTenantContext(), readRememberedAuthUserSub())
        : undefined;
    const priorEtag =
      cacheKey && !bypassConditionalGet ? peekConditionalGetEtag(cacheKey) : null;
    const conditionalHeaders: Record<string, string> =
      priorEtag ? { 'If-None-Match': priorEtag } : {};

    // Merge headers
    const requestHeaders = {
      ...this.defaultHeaders,
      ...authHeaders,
      ...csrfHeaders,
      ...tenantHeaders,
      ...conditionalHeaders,
      ...headers,
    };

    // Timeout + optional caller signal (e.g. React Query cancellation)
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    const fetchSignal = buildRequestSignal(timeout, signal);
    if (fetchSignal.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    try {
      const response = await fetch(fullURL, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: fetchSignal,
        // Same-origin GETs otherwise reuse the browser HTTP cache and send
        // If-None-Match after reload — the in-memory ETag store is empty then,
        // so a 304 was thrown as a user-facing error on every dashboard.
        cache: 'no-store',
      });

      if (response.status === 304 && !bypassConditionalGet) {
        const cached = bodyForNotModified<T>(cacheKey);
        if (cached) return cached;
        return this.request<T>(url, { ...config, bypassConditionalGet: true });
      }

      const skipAuthExpire =
        config.skipErrorNotify === true || url.includes('/document-edit-leases/');
      return await this.handleResponse<T>(response, cacheKey, skipAuthExpire);
    } catch (error) {
      throw normalizeFetchFailure(error);
    }
  }

  /**
   * GET request
   */
  async get<T>(url: string, params?: QueryParams, config?: Omit<RequestConfig, 'method' | 'body' | 'params'>): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>(url, {
      ...config,
      method: 'GET',
      params,
    });
  }

  /**
   * POST request
   */
  async post<T>(url: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>(url, {
      ...config,
      method: 'POST',
      body,
    });
  }

  /**
   * POST that returns the raw Fetch Response so callers can consume SSE / streams.
   * Does not parse JSON and does not retry — the caller owns the body.
   */
  async streamPost(
    url: string,
    body?: unknown,
    config?: { signal?: AbortSignal; timeout?: number; headers?: Record<string, string> }
  ): Promise<Response> {
    const method = 'POST';
    const timeout = config?.timeout ?? 180_000;
    const token = this.getAuthToken();
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const csrfHeaders: Record<string, string> = {};
    if (typeof document !== 'undefined') {
      const match = document.cookie
        ?.split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('XSRF-TOKEN='));
      if (match) {
        const value = decodeURIComponent(match.split('=')[1] || '');
        if (value) csrfHeaders['X-CSRF-Token'] = value;
      }
    }
    const tenantHeaders = this.shouldAttachTenantHeaders(url)
      ? buildTenantRequestHeaders(method, true)
      : {};
    const fullURL = `${this.resolveBaseURL()}${url}`;
    const fetchSignal = buildRequestSignal(timeout, config?.signal);
    try {
      return await fetch(fullURL, {
        method,
        headers: {
          ...this.defaultHeaders,
          ...authHeaders,
          ...csrfHeaders,
          ...tenantHeaders,
          Accept: 'text/event-stream, application/json',
          ...config?.headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: fetchSignal,
      });
    } catch (error) {
      throw normalizeFetchFailure(error);
    }
  }

  /**
   * Multipart upload. Lets the browser set the FormData boundary.
   */
  async upload<T>(url: string, form: FormData, config?: { signal?: AbortSignal; timeout?: number }): Promise<ApiResponse<T>> {
    const timeout = config?.timeout ?? 180_000;
    const token = this.getAuthToken();
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const csrfHeaders: Record<string, string> = {};
    if (typeof document !== 'undefined') {
      const match = document.cookie
        ?.split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('XSRF-TOKEN='));
      if (match) {
        const value = decodeURIComponent(match.split('=')[1] || '');
        if (value) csrfHeaders['X-CSRF-Token'] = value;
      }
    }
    const tenantHeaders = this.shouldAttachTenantHeaders(url)
      ? buildTenantRequestHeaders('POST', true)
      : {};
    const fullURL = `${this.resolveBaseURL()}${url}`;
    const fetchSignal = buildRequestSignal(timeout, config?.signal);
    try {
      const response = await fetch(fullURL, {
        method: 'POST',
        headers: {
          ...authHeaders,
          ...csrfHeaders,
          ...tenantHeaders,
        },
        body: form,
        signal: fetchSignal,
      });
      const parsed = await this.handleResponse<T>(response);
      this.broadcastSuccess(url, { method: 'POST', skipSuccessNotify: false }, parsed);
      return parsed;
    } catch (error) {
      throw normalizeFetchFailure(error);
    }
  }

  /**
   * PUT request
   */
  async put<T>(url: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>(url, {
      ...config,
      method: 'PUT',
      body,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>(url, {
      ...config,
      method: 'PATCH',
      body,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, params?: QueryParams, config?: Omit<RequestConfig, 'method' | 'body' | 'params'>): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>(url, {
      ...config,
      method: 'DELETE',
      params,
    });
  }
}

function isSilentSuccessUrl(url: string): boolean {
  const path = (url.split('?')[0] ?? url).replace(/\/$/, '');
  if (path.endsWith('/last-rate')) return true;
  if (path === '/users/me/ui-preferences') return true;
  if (path === '/notifications/mark-all-read') return true;
  if (/\/notifications\/[^/]+\/read$/.test(path)) return true;
  if (path === '/onboarding/complete-tour') return true;
  if (/\/ai\/insights\/[^/]+\/dismiss$/.test(path)) return true;
  if (/\/ai\/actions\/[^/]+\/acknowledge$/.test(path)) return true;
  if (/\/growth\/[^/]+\/(dismiss|review)$/.test(path)) return true;
  return false;
}

// Export singleton instance
export const apiClient = new ApiClient();
if (typeof window !== 'undefined') {
  apiClient.ensureAuthCookie();
}
export default apiClient;

