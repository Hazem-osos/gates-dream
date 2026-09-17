'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAppTabs } from '@/app/components/AppTabsContext';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { TabOwnPathContext } from '@/lib/navigation/tab-route-lock';
import {
  isMasterCatalogKey,
  masterCatalogGeneration,
} from '@/lib/query/master-catalog-sync';

export function TabPageCache({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ctx = useAppTabs();
  const queryClient = useQueryClient();
  const cacheRef = useRef(new Map<string, { nonce: number; node: ReactNode }>());
  const seenCatalogRef = useRef(new Map<string, number>());
  const active = pathname ? normalizeAppPath(pathname) : '';
  const openPaths = new Set((ctx?.tabs ?? []).map((tab) => tab.path));
  const activeNonce = ctx?.freshNonceByPath?.[active] ?? 0;

  if (active) {
    const cached = cacheRef.current.get(active);
    if (!cached || cached.nonce !== activeNonce) {
      cacheRef.current.set(active, { nonce: activeNonce, node: children });
    }
  }

  for (const path of [...cacheRef.current.keys()]) {
    if (path !== active && openPaths.size > 0 && !openPaths.has(path)) {
      cacheRef.current.delete(path);
      seenCatalogRef.current.delete(path);
    }
  }

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
    <>
      {[...cacheRef.current.entries()].map(([path, entry]) => {
        const isActive = path === active;
        return (
          <div
            key={`${path}:${entry.nonce}`}
            hidden={!isActive}
            inert={!isActive}
            className={isActive ? 'min-h-full min-w-0 max-w-full' : 'hidden'}
          >
            <TabOwnPathContext.Provider value={path}>{entry.node}</TabOwnPathContext.Provider>
          </div>
        );
      })}
    </>
  );
}
