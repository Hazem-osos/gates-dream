import type { QueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '@/lib/api/types';

/**
 * Last post/unpost we already applied for a document.
 * A slower GET that still says "posted" must not put the screen back
 * into the posted state after فك الترحيل.
 */
type Trust = { version: number; posted: boolean };

const trustById = new Map<string, Trust>();

const ACTION_URL =
  /\/([0-9a-zA-Z-]{8,})\/(unpost|post)\/?$/;

type PostingRecord = {
  id?: string | null;
  version?: number | null;
  isPosted?: boolean | null;
  postingStatus?: string | null;
};

export function postingActionFromUrl(url: string): { id: string; posted: boolean } | null {
  const path = url.split('?')[0] ?? url;
  const match = ACTION_URL.exec(path);
  if (!match?.[1] || !match[2]) return null;
  return { id: match[1], posted: match[2].toLowerCase() === 'post' };
}

export function trustPostingState(id: string, version: number | null | undefined, posted: boolean) {
  const current = trustById.get(id);
  const nextVersion =
    typeof version === 'number' && Number.isFinite(version)
      ? version
      : (current?.version ?? 0) + 1;
  if (!current || nextVersion >= current.version) {
    trustById.set(id, { version: nextVersion, posted });
  }
}

export function rememberPostingResponse(url: string, body: ApiResponse<unknown> | undefined) {
  const action = postingActionFromUrl(url);
  if (!action) return;
  const row =
    body?.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as PostingRecord)
      : undefined;
  const id = typeof row?.id === 'string' && row.id.length > 0 ? row.id : action.id;
  trustPostingState(id, row?.version, action.posted);
}

function serverSaysPosted(record: PostingRecord): boolean {
  return Boolean(record.isPosted) || record.postingStatus === 'Post';
}

/** Posted flag the screen should show. The latest post/unpost wins over an older snapshot. */
export function resolvePostedFlag(record: PostingRecord | null | undefined): boolean {
  if (!record) return false;
  const serverPosted = serverSaysPosted(record);
  if (!record.id) return serverPosted;
  const current = trustById.get(record.id);
  if (!current) return serverPosted;
  const version = typeof record.version === 'number' && Number.isFinite(record.version) ? record.version : 0;
  if (version < current.version) return current.posted;
  if (version === current.version) return current.posted;
  trustById.set(record.id, { version, posted: serverPosted });
  return serverPosted;
}

export function applyTrustedPostingState<T>(body: ApiResponse<T>): ApiResponse<T> {
  const data = body?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return body;
  const row = data as PostingRecord;
  if (typeof row.id !== 'string') return body;
  if (typeof row.isPosted !== 'boolean' && row.postingStatus == null) return body;
  const posted = resolvePostedFlag(row);
  const postingStatus =
    row.postingStatus == null ? undefined : posted ? 'Post' : 'UnPost';
  if (posted === Boolean(row.isPosted) && postingStatus === row.postingStatus) return body;
  return {
    ...body,
    data: {
      ...row,
      isPosted: posted,
      ...(postingStatus != null ? { postingStatus } : {}),
    } as T,
  };
}

function patchCachedDocument(old: unknown, id: string, posted: boolean, mutationData: unknown): unknown {
  if (!old || typeof old !== 'object') return old;
  const wrapped = old as { data?: unknown };
  const current = wrapped.data;
  if (!current || typeof current !== 'object' || Array.isArray(current)) return old;
  if ((current as PostingRecord).id !== id) return old;
  const fromMutation =
    mutationData &&
    typeof mutationData === 'object' &&
    !Array.isArray(mutationData) &&
    (mutationData as PostingRecord).id === id
      ? (mutationData as Record<string, unknown>)
      : null;
  const base = current as Record<string, unknown>;
  const next: Record<string, unknown> = {
    ...base,
    ...(fromMutation ?? {}),
    isPosted: posted,
  };
  if ('postingStatus' in base || (fromMutation && 'postingStatus' in fromMutation)) {
    next.postingStatus = posted ? 'Post' : 'UnPost';
  }
  return { ...wrapped, data: next };
}

/** Drop in-flight GETs of this document, then write the post/unpost result into the open screen cache. */
export async function sealDocumentPostingCache(
  queryClient: QueryClient,
  url: string,
  body: ApiResponse<unknown> | undefined
) {
  const action = postingActionFromUrl(url);
  if (!action) return;
  rememberPostingResponse(url, body);
  const matches = (query: { queryKey: readonly unknown[] }) =>
    query.queryKey.some((part) => part === action.id);
  await queryClient.cancelQueries({ predicate: matches });
  queryClient.setQueriesData({ predicate: matches }, (old) =>
    patchCachedDocument(old, action.id, action.posted, body?.data)
  );
}
