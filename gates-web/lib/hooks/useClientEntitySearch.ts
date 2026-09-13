'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchIndexEntity } from '@/workers/search.worker';
import {
  clientSearch,
  isClientSearchAvailable,
  rebuildClientSearchIndex,
} from '@/lib/search/clientSearchBridge';

export function useClientEntitySearch(entity: SearchIndexEntity) {
  const [ready, setReady] = useState(false);
  const docsRef = useRef<{ id: string; fields: string[] }[]>([]);

  const syncIndex = useCallback(
    (docs: { id: string; fields: string[] }[]) => {
      docsRef.current = docs;
      if (!isClientSearchAvailable()) {
        setReady(false);
        return;
      }
      rebuildClientSearchIndex(entity, docs);
      setReady(true);
    },
    [entity]
  );

  const search = useCallback(
    async (query: string): Promise<string[]> => {
      if (!query.trim()) return [];
      if (!isClientSearchAvailable()) return [];
      return clientSearch(entity, query);
    },
    [entity]
  );

  useEffect(() => {
    if (docsRef.current.length) {
      rebuildClientSearchIndex(entity, docsRef.current);
    }
  }, [entity]);

  return { syncIndex, search, ready };
}
