import { isVersionConflictError } from '@/lib/concurrency/version-conflict';

export type ApiErrorNotification = {
  message: string;
  httpStatus?: number;
  code?: string;
  url?: string;
};

type Listener = (payload: ApiErrorNotification) => void;

const listeners = new Set<Listener>();

export function subscribeApiErrors(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const DEDUPE_MS = 4000;
let lastDedupeKey = '';
let lastDedupeAt = 0;

export function apiErrorDedupeKey(payload: ApiErrorNotification): string {
  return `${payload.httpStatus ?? ''}|${payload.code ?? ''}|${payload.message}`;
}

/** Test helper — resets the in-memory toast window. */
export function resetApiErrorNotifyDedupe(): void {
  lastDedupeKey = '';
  lastDedupeAt = 0;
}

export function notifyApiError(payload: ApiErrorNotification): void {
  if (!payload.message) return;
  const key = apiErrorDedupeKey(payload);
  const now = Date.now();
  if (key === lastDedupeKey && now - lastDedupeAt < DEDUPE_MS) {
    return;
  }
  lastDedupeKey = key;
  lastDedupeAt = now;
  for (const listener of listeners) {
    listener(payload);
  }
}

export {
  localizeApiErrorMessage,
  localizeUnknownError,
} from './localize-api-error-message';

// Wave 5 fix: this used to only broadcast 401/403/429 and a narrow
// fiscal-closed 422 pattern. Every other failure (400 validation, 409
// optimistic-lock conflicts, the general 422 case, 500s) relied entirely on
// whichever component happened to pass a custom `onError` to
// useApiMutation/useApiQuery — most don't, so those failures went
// completely silent: the request failed, nothing rendered, and the only
// trace was a console.warn in dev. Broadcasting these globally (still
// deduped per-message by the toast layer) turns silent failures into a
// visible, actionable message for every screen at once.
export function shouldBroadcastApiError(httpStatus: number): boolean {
  if (httpStatus === 304) return false;
  if (httpStatus === 400) return true;
  if (httpStatus === 401) return true;
  if (httpStatus === 403) return true;
  if (httpStatus === 409) return true;
  if (httpStatus === 422) return true;
  if (httpStatus === 429) return true;
  if (httpStatus >= 500) return true;
  return false;
}

/** Validation / business-rule failures shown by AiErrorModal instead of a generic toast. */
export function isBusinessSupportError(payload: ApiErrorNotification): boolean {
  if (isVersionConflictError(payload)) return false;
  const status = payload.httpStatus;
  if (status !== 400 && status !== 409 && status !== 422) return false;
  const url = payload.url ?? '';
  if (url.includes('/ai/') || url.includes('/auth/') || url.includes('/users/me')) return false;
  return Boolean(payload.message);
}
