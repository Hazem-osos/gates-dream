'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { resolveTabLabel } from '@/lib/navigation/tab-labels';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import {
  MAX_OPEN_TABS,
  loadOpenTabs,
  persistOpenTabs,
  pinCurrentWindowHref,
  pickTabReturnHref,
  rememberTabHref,
  rememberTabSearch,
  rememberFreshPage,
  resolveAppTabHref,
  noteOpenDocumentSettingsHref,
  splitTabHref,
  stripEphemeralTabHref,
  TAB_QUERY_PINNED_EVENT,
  type PersistedAppTab,
} from '@/lib/navigation/tab-memory';
import { tabHrefFromRoute } from '@/lib/navigation/tab-route-sync';
import { flushPageDrafts } from '@/lib/drafts/page-drafts';
import { probeCount, probeNavUrl } from '@/lib/debug/gates-crash-probe';

export type AppTab = PersistedAppTab;

type AppTabsContextValue = {
  tabs: AppTab[];
  justOpenedPath: string | null;
  freshNonceByPath: Record<string, number>;
  addBackgroundTab: (path: string) => void;
  closeTab: (path: string) => void;
  hrefForTab: (path: string) => string;
  pinCurrentTab: () => void;
  openAppTab: (href: string) => void;
  openFreshPage: (href: string) => void;
  /** Register tab before Link navigation (no router.push). */
  primeTabNavigation: (href: string) => void;
};

const AppTabsContext = createContext<AppTabsContextValue | null>(null);

export { splitTabHref };

function toTab(input: string): AppTab {
  const { path, href } = splitTabHref(input);
  return { path, href: stripEphemeralTabHref(href), label: resolveTabLabel(path) };
}

/**
 * Isolated so useSearchParams suspends only this subtree — not the whole ERP shell.
 * (AppTabsProvider must not call useSearchParams directly; ErpApp Suspense fallback is null.)
 */
function TabRouteSync({
  pathname,
  upsertTab,
}: {
  pathname: string | null;
  upsertTab: (input: string, opts?: { background?: boolean; fresh?: boolean }) => void;
}) {
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const lastHrefRef = useRef<string | null>(null);

  useEffect(() => {
    const href = tabHrefFromRoute(pathname, searchString);
    if (!href) return;
    if (lastHrefRef.current === href) return;
    lastHrefRef.current = href;
    upsertTab(href);
    const path = normalizeAppPath(pathname!);
    document.title = `${resolveTabLabel(path)} | GATES`;
    return () => {
      pinCurrentWindowHref();
    };
  }, [pathname, searchString, upsertTab]);

  return null;
}

function AppTabsProviderInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [justOpenedPath, setJustOpenedPath] = useState<string | null>(null);
  const [freshNonceByPath, setFreshNonceByPath] = useState<Record<string, number>>({});
  const restoredTabsRef = useRef(false);

  /** Restore before TabRouteSync's useEffect — otherwise upsert wins and stored tabs are dropped on reload. */
  useLayoutEffect(() => {
    if (restoredTabsRef.current) return;
    restoredTabsRef.current = true;
    const stored = loadOpenTabs();
    if (stored.length) {
      setTabs(stored.slice(0, MAX_OPEN_TABS));
    }
  }, []);

  const upsertTab = useCallback(
    (input: string, opts?: { background?: boolean; fresh?: boolean; pinned?: boolean }) => {
    const next = toTab(input);
    probeCount('tab state updates');
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.path === next.path);
      if (index === -1) {
        rememberTabHref(next.path, next.href);
        if (next.href.includes('?')) {
          rememberTabSearch(next.path, next.href.slice(next.href.indexOf('?') + 1));
        } else if (opts?.fresh) {
          rememberTabSearch(next.path, '');
        }
        const row = { ...next };
        if (prev.length >= MAX_OPEN_TABS) {
          return [...prev.slice(1), row];
        }
        return [...prev, row];
      }
      const current = prev[index];
      const incomingBare = next.href === next.path;
      const existingHasDoc = current.href !== current.path;
      // Next searchParams often lag behind replaceState after save. Do not
      // let a bare route-sync wipe ?id= unless this is an explicit pin/fresh.
      const keepExistingHref =
        !opts?.fresh &&
        !opts?.pinned &&
        incomingBare &&
        existingHasDoc;
      const href = keepExistingHref ? current.href : next.href;
      rememberTabHref(next.path, href);
      if (href.includes('?')) {
        rememberTabSearch(next.path, href.slice(href.indexOf('?') + 1));
      } else if (opts?.fresh || opts?.pinned) {
        rememberTabSearch(next.path, '');
      }
      if (current.label === next.label && current.href === href) return prev;
      return prev.map((tab, i) => (i === index ? { ...next, href } : tab));
    });
  },
  []
);

  useEffect(() => {
    const onPinned = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string; href?: string }>).detail;
      if (!detail?.path || !detail.href) return;
      upsertTab(detail.href, { pinned: true, fresh: detail.href === detail.path });
    };
    window.addEventListener(TAB_QUERY_PINNED_EVENT, onPinned);
    return () => window.removeEventListener(TAB_QUERY_PINNED_EVENT, onPinned);
  }, [upsertTab]);

  const addBackgroundTab = useCallback(
    (path: string) => {
      const { path: normalized } = splitTabHref(path);
      upsertTab(path, { background: true });
      setJustOpenedPath(normalized);
      window.setTimeout(() => {
        setJustOpenedPath((current) => (current === normalized ? null : current));
      }, 1600);
    },
    [upsertTab]
  );

  const closeTab = useCallback((path: string) => {
    const normalized = normalizeAppPath(path);
    probeCount('tab state updates');
    setTabs((prev) => prev.filter((tab) => tab.path !== normalized));
  }, []);

  const hrefForTab = useCallback(
    (path: string) => {
      const normalized = normalizeAppPath(path);
      const tabHref = tabs.find((tab) => tab.path === normalized)?.href;
      return pickTabReturnHref(normalized, tabHref);
    },
    [tabs]
  );

  const pinCurrentTab = useCallback(() => {
    pinCurrentWindowHref();
    if (typeof window === 'undefined') return;
    upsertTab(`${window.location.pathname}${window.location.search}`);
  }, [upsertTab]);

  const remountPage = useCallback((path: string) => {
    setFreshNonceByPath((prev) => ({ ...prev, [path]: (prev[path] ?? 0) + 1 }));
  }, []);

  const primeTabNavigation = useCallback(
    (href: string) => {
      noteOpenDocumentSettingsHref(href);
      const dest = resolveAppTabHref(href);
      upsertTab(dest);
    },
    [upsertTab]
  );

  const openAppTab = useCallback(
    (href: string) => {
      probeCount('openAppTab', { href });
      noteOpenDocumentSettingsHref(href);
      flushPageDrafts();
      pinCurrentTab();
      const dest = resolveAppTabHref(href);
      const path = splitTabHref(dest).path;
      const fresh = dest === path;
      if (fresh) {
        rememberFreshPage(path);
        remountPage(path);
      }
      upsertTab(dest, { fresh });
      setJustOpenedPath(path);
      window.setTimeout(() => {
        setJustOpenedPath((current) => (current === path ? null : current));
      }, 1600);
      probeCount('router.push');
      probeNavUrl(`${window.location.pathname}${window.location.search}`, dest);
      router.push(dest);
    },
    [pinCurrentTab, remountPage, router, upsertTab]
  );

  const openFreshPage = useCallback(
    (href: string) => {
      probeCount('openFreshPage', { href });
      noteOpenDocumentSettingsHref(href);
      flushPageDrafts();
      pinCurrentTab();
      const dest = resolveAppTabHref(href);
      const path = splitTabHref(dest).path;
      rememberFreshPage(path);
      remountPage(path);
      upsertTab(dest, { fresh: true });
      probeCount('router.push');
      probeNavUrl(`${window.location.pathname}${window.location.search}`, dest);
      router.push(dest);
    },
    [pinCurrentTab, remountPage, router, upsertTab]
  );

  useEffect(() => {
    persistOpenTabs(tabs);
  }, [tabs]);

  const value = useMemo(
    () => ({
      tabs,
      justOpenedPath,
      freshNonceByPath,
      addBackgroundTab,
      closeTab,
      hrefForTab,
      pinCurrentTab,
      openAppTab,
      openFreshPage,
      primeTabNavigation,
    }),
    [
      tabs,
      justOpenedPath,
      freshNonceByPath,
      addBackgroundTab,
      closeTab,
      hrefForTab,
      pinCurrentTab,
      openAppTab,
      openFreshPage,
      primeTabNavigation,
    ]
  );

  return (
    <AppTabsContext.Provider value={value}>
      <Suspense fallback={null}>
        <TabRouteSync pathname={pathname} upsertTab={upsertTab} />
      </Suspense>
      {children}
    </AppTabsContext.Provider>
  );
}

export function AppTabsProvider({ children }: { children: ReactNode }) {
  return <AppTabsProviderInner>{children}</AppTabsProviderInner>;
}

export function useAppTabs(): AppTabsContextValue | null {
  return useContext(AppTabsContext);
}
