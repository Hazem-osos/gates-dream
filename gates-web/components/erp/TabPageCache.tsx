'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { TabOwnPathContext } from '@/lib/navigation/tab-route-lock';
import {
  isMasterCatalogKey,
  masterCatalogGeneration,
} from '@/lib/query/master-catalog-sync';

/**
 * Must render the live App Router `children` once.
 * Caching/replaying that slot (hidden tabs) throws a client exception
 * because Next.js children are a one-shot Flight payload, not a normal tree.
 */
export function TabPageCache({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const seenCatalogRef = useRef(new Map<string, number>());
  const active = pathname ? normalizeAppPath(pathname) : '';

  useEffect(() => {
    if (!active) return;
    const gen = masterCatalogGeneration();
    const seen = seenCatalogRef.current.get(active) ?? -1;
    seenCatalogRef.current.set(active, gen);
    if (seen < 0 || seen === gen) return;
    void queryClient.invalidateQueries({
      predicate: (query) => isMasterCatalogKey(query.queryKey),
      refetchType: 'active',
    });
  }, [active, queryClient]);

  return (
    <TabOwnPathContext.Provider value={active}>
      <div className="min-h-full min-w-0 max-w-full">{children}</div>
    </TabOwnPathContext.Provider>
  );
}
