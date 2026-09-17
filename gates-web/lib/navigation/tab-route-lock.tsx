'use client';

import { createContext, useCallback, useContext, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { rememberTabSearch, recalledTabSearch } from '@/lib/navigation/tab-memory';

export const TabOwnPathContext = createContext<string>('');

export function useOwnTabPathname() {
  const live = usePathname();
  const ownPath = useContext(TabOwnPathContext);
  return ownPath || live || '';
}

export function useIsOwnTabActive() {
  const pathname = usePathname();
  const ownPath = useContext(TabOwnPathContext);
  if (!ownPath) return true;
  if (!pathname) return true;
  return normalizeAppPath(pathname) === normalizeAppPath(ownPath);
}

/** Search params frozen to this cached tab so hidden pages do not reset on navigation. */
export function useOwnTabSearchParams() {
  const live = useSearchParams();
  const isActive = useIsOwnTabActive();
  const ownPath = useContext(TabOwnPathContext);
  const path = normalizeAppPath(ownPath || '');
  const remembered = path ? recalledTabSearch(path) : '';
  const liveStr0 = live.toString();
  const seed = isActive ? liveStr0 : remembered || liveStr0;
  const frozenStr = useRef(seed);
  const frozenObj = useRef<URLSearchParams>(new URLSearchParams(seed));
  const wasActive = useRef(isActive && Boolean(liveStr0));

  if (isActive) {
    const liveStr = live.toString();
    const becameActive = !wasActive.current;
    if (becameActive || frozenStr.current !== liveStr) {
      frozenStr.current = liveStr;
      frozenObj.current = new URLSearchParams(liveStr);
      if (path) rememberTabSearch(path, liveStr);
    }
    wasActive.current = true;
    return live;
  }

  if (wasActive.current) {
    frozenObj.current = new URLSearchParams(frozenStr.current);
    if (path) rememberTabSearch(path, frozenStr.current);
  }
  wasActive.current = false;
  return frozenObj.current;
}

/** After save: drop the open-record query so the tab is a blank «جديد». */
export function useClearDocumentQuery() {
  const router = useRouter();
  const pathname = useOwnTabPathname();
  const searchParams = useOwnTabSearchParams();
  return useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    for (const key of ['id', 'mode', 'invoiceId'] as const) {
      if (params.has(key)) {
        params.delete(key);
        changed = true;
      }
    }
    if (!changed) return;
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);
}
