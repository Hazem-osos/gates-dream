'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateMasterCatalog, MASTER_CATALOG_EVENT } from '@/lib/query/master-catalog-sync';

/** Hidden document tabs stay mounted — refetch their pickers after a master card is saved. */
export function MasterCatalogSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onChange = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
      invalidateMasterCatalog(queryClient, kind);
    };
    window.addEventListener(MASTER_CATALOG_EVENT, onChange);
    return () => window.removeEventListener(MASTER_CATALOG_EVENT, onChange);
  }, [queryClient]);

  return null;
}
