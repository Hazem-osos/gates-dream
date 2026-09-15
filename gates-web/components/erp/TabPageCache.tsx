'use client';

import { useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAppTabs } from '@/app/components/AppTabsContext';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';

export function TabPageCache({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ctx = useAppTabs();
  const cacheRef = useRef(new Map<string, ReactNode>());
  const active = pathname ? normalizeAppPath(pathname) : '';
  const openPaths = new Set((ctx?.tabs ?? []).map((tab) => tab.path));

  if (active && !cacheRef.current.has(active)) {
    cacheRef.current.set(active, children);
  }

  for (const path of [...cacheRef.current.keys()]) {
    if (path !== active && openPaths.size > 0 && !openPaths.has(path)) {
      cacheRef.current.delete(path);
    }
  }

  return (
    <>
      {[...cacheRef.current.entries()].map(([path, node]) => {
        const isActive = path === active;
        return (
          <div
            key={path}
            hidden={!isActive}
            inert={!isActive}
            className={isActive ? 'min-h-full' : 'hidden'}
          >
            {node}
          </div>
        );
      })}
    </>
  );
}
