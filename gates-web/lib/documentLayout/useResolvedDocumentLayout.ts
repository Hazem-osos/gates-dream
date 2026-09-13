'use client';

import { apiClient } from '@/lib/api/client';
import { useApiQuery } from '@/lib/hooks/useApi';
import { cloneDefaultConfig } from './defaults';
import type { DocumentLayoutConfig, DocumentLayoutType } from './types';

export function useResolvedDocumentLayout(documentType: DocumentLayoutType, enabled = true) {
  return useApiQuery<DocumentLayoutConfig>(
    ['document-layout-resolve', documentType],
    '/document-layout-configs/resolve',
    { documentType },
    { enabled }
  );
}

export function effectiveLayoutConfig(remote?: DocumentLayoutConfig | null): DocumentLayoutConfig {
  return { ...cloneDefaultConfig(), ...(remote ?? {}) };
}

/** Resolves tenant layout for print; never throws — defaults if unauthorized or offline. */
export async function resolveDocumentLayout(documentType: DocumentLayoutType): Promise<DocumentLayoutConfig> {
  try {
    const res = await apiClient.get<DocumentLayoutConfig>('/document-layout-configs/resolve', { documentType });
    return effectiveLayoutConfig(res.data);
  } catch {
    return cloneDefaultConfig();
  }
}
