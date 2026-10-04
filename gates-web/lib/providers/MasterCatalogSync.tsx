'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  MASTER_CATALOG_EVENT,
  refreshAfterWrite,
  type CatalogWriteDetail,
} from '@/lib/query/master-catalog-sync';

/** After any save, open lists and next-serial fields reload. */
export function MasterCatalogSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<CatalogWriteDetail>).detail;
      refreshAfterWrite(queryClient, detail);
    };
    window.addEventListener(MASTER_CATALOG_EVENT, onChange);
    return () => window.removeEventListener(MASTER_CATALOG_EVENT, onChange);
  }, [queryClient]);

  return null;
}
