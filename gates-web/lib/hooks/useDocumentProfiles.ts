'use client';

import { useMemo } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import type { DocumentBaseType, DocumentProfile } from '@/lib/document-profiles/types';

export function useDocumentProfiles(opts?: {
  baseType?: DocumentBaseType;
  sidebarOnly?: boolean;
  includeInactive?: boolean;
  enabled?: boolean;
}) {
  const params: Record<string, string | boolean> = {};
  if (opts?.baseType) params.baseType = opts.baseType;
  if (opts?.sidebarOnly) params.sidebarOnly = true;
  if (opts?.includeInactive) params.includeInactive = true;

  return useApiQuery<DocumentProfile[]>(
    ['document-profiles', opts?.baseType ?? 'all', opts?.sidebarOnly ? 'sidebar' : 'list'],
    '/document-profiles',
    params,
    { enabled: opts?.enabled !== false }
  );
}

export function useDocumentProfileBySlug(slug?: string | null) {
  const trimmed = slug?.trim() || '';
  return useApiQuery<DocumentProfile>(
    ['document-profile', trimmed],
    trimmed ? `/document-profiles/by-slug/${encodeURIComponent(trimmed)}` : '',
    undefined,
    { enabled: Boolean(trimmed) }
  );
}

export function useSidebarDocumentProfiles() {
  const query = useDocumentProfiles({ sidebarOnly: true });
  const profiles = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  return { ...query, profiles };
}
