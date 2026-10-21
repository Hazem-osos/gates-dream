'use client';

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { rememberTabSearch, recalledTabSearch, stripEphemeralTabQuery } from '@/lib/navigation/tab-memory';

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
  const router = useRouter();
  const isActive = useIsOwnTabActive();
  const ownPath = useContext(TabOwnPathContext);
  const path = normalizeAppPath(ownPath || '');
  const remembered = path ? recalledTabSearch(path) : '';
  const liveStr0 = live.toString();
  const seed = stripEphemeralTabQuery(isActive ? liveStr0 : remembered || liveStr0);
  const frozenStr = useRef(seed);
  const frozenObj = useRef<URLSearchParams>(new URLSearchParams(seed));
  const wasActive = useRef(isActive && Boolean(liveStr0));
  const liveSearch = live.toString();
  const healAttemptedRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      healAttemptedRef.current = false;
      return;
    }
    if (!path || liveSearch || !remembered || healAttemptedRef.current) return;
    healAttemptedRef.current = true;
    router.replace(`${path}?${remembered}`, { scroll: false });
  }, [isActive, liveSearch, path, remembered, router]);

  if (isActive) {
    const liveStr = liveSearch;
    const becameActive = !wasActive.current;
    const persistedStr = stripEphemeralTabQuery(liveStr || remembered);
    if (becameActive || frozenStr.current !== persistedStr) {
      frozenStr.current = persistedStr;
      frozenObj.current = new URLSearchParams(persistedStr);
      if (path) rememberTabSearch(path, persistedStr);
    }
    wasActive.current = true;
    if (liveStr) return live;
    if (remembered) return frozenObj.current;
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
