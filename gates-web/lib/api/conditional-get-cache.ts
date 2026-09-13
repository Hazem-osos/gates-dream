import type { ApiResponse } from './types';
import type { TenantContextSnapshot } from '@/lib/tenant/tenant-context-storage';

type Entry = {
  etag: string;
  body: ApiResponse<unknown>;
};

const MAX_ENTRIES = 200;
const store = new Map<string, Entry>();

export function buildConditionalGetKey(
  method: string,
  fullUrl: string,
  tenant: TenantContextSnapshot,
  userSub: string | null
): string {
  return [
    method.toUpperCase(),
    fullUrl,
    tenant.companyId ?? '',
    tenant.branchId ?? '',
    tenant.fiscalYearId ?? '',
    userSub ?? '',
  ].join('\u001f');
}

export function peekConditionalGetEtag(key: string): string | null {
  return store.get(key)?.etag ?? null;
}

export function getConditionalGetBody<T>(key: string): ApiResponse<T> | null {
  const entry = store.get(key);
  return entry ? (entry.body as ApiResponse<T>) : null;
}

/** Return the last 200 body when the origin answers 304. */
export function bodyForNotModified<T>(key: string | undefined): ApiResponse<T> | null {
  if (!key) return null;
  return getConditionalGetBody<T>(key);
}

export function rememberConditionalGet(key: string, etag: string, body: ApiResponse<unknown>): void {
  if (store.has(key)) store.delete(key);
  store.set(key, { etag, body });
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest == null) break;
    store.delete(oldest);
  }
}

export function clearConditionalGetCache(): void {
  store.clear();
}
