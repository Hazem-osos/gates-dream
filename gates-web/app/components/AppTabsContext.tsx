'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  recalledTabHref,
  rememberTabHref,
  rememberTabSearch,
  rememberFreshPage,
  resolveAppTabHref,
  scheduleHardNavigationFallback,
  splitTabHref,
  type PersistedAppTab,
} from '@/lib/navigation/tab-memory';
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
};

const AppTabsContext = createContext<AppTabsContextValue | null>(null);

export { splitTabHref };

function toTab(input: string): AppTab {
  const { path, href } = splitTabHref(input);
  return { path, href, label: resolveTabLabel(path) };
}

function TabUrlSync({
  pathname,
  upsertTab,
}: {
  pathname: string | null;
  upsertTab: (input: string, opts?: { background?: boolean; fresh?: boolean }) => void;
}) {
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();

  useEffect(() => {
    if (!pathname) return;
    const path = normalizeAppPath(pathname);
    const href = searchString ? `${path}?${searchString}` : path;
    upsertTab(href);
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
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = loadOpenTabs();
    if (stored.length) {
      setTabs(stored.slice(0, MAX_OPEN_TABS));
    }
  }, []);

  const upsertTab = useCallback((input: string, opts?: { background?: boolean; fresh?: boolean }) => {
    const next = toTab(input);
    const activePath = pathnameRef.current ? normalizeAppPath(pathnameRef.current) : '';
    rememberTabHref(next.path, next.href);
    if (next.href.includes('?')) {
      rememberTabSearch(next.path, next.href.slice(next.href.indexOf('?') + 1));
    } else if (opts?.fresh) {
      rememberTabSearch(next.path, '');
    }
    probeCount('tab state updates');
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.path === next.path);
      if (index === -1) {
        const row = { ...next };
        if (prev.length >= MAX_OPEN_TABS) {
          return [...prev.slice(1), row];
        }
        return [...prev, row];
      }
      const current = prev[index];
      const incomingBare = next.href === next.path;
      const existingHasDoc = current.href !== current.path;
      const keepExistingHref =
        !opts?.fresh &&
        (opts?.background || next.path !== activePath) &&
        incomingBare &&
        existingHasDoc;
      const href = keepExistingHref ? current.href : next.href;
      if (!keepExistingHref) rememberTabHref(next.path, href);
      if (current.label === next.label && current.href === href) return prev;
      return prev.map((tab, i) => (i === index ? { ...next, href } : tab));
    });
  }, []);

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
      return tabs.find((tab) => tab.path === normalized)?.href
        ?? recalledTabHref(normalized)
        ?? normalized;
    },
    [tabs]
  );

  const pinCurrentTab = useCallback(() => {
    pinCurrentWindowHref();
    if (typeof window === 'undefined') return;
    upsertTab(`${window.location.pathname}${window.location.search}`);
  }, [upsertTab]);

  const pushRoute = useCallback(
    (href: string) => {
      const dest = resolveAppTabHref(href);
      probeCount('router.push');
      probeNavUrl(`${window.location.pathname}${window.location.search}`, dest);
      router.push(dest);
      scheduleHardNavigationFallback(dest);
    },
    [router]
  );

  const openAppTab = useCallback(
    (href: string) => {
      probeCount('openAppTab', { href });
      flushPageDrafts();
      pinCurrentWindowHref();
      const dest = resolveAppTabHref(href);
      const path = splitTabHref(dest).path;
      if (dest === path) rememberFreshPage(path);
      setJustOpenedPath(path);
      window.setTimeout(() => {
        setJustOpenedPath((current) => (current === path ? null : current));
      }, 1600);
      pushRoute(dest);
    },
    [pushRoute]
  );

  const openFreshPage = useCallback(
    (href: string) => {
      probeCount('openFreshPage', { href });
      flushPageDrafts();
      pinCurrentWindowHref();
      const dest = resolveAppTabHref(href);
      const path = splitTabHref(dest).path;
      rememberFreshPage(path);
      pushRoute(dest);
    },
    [pushRoute]
  );

  useEffect(() => {
    const handle = window.setTimeout(() => persistOpenTabs(tabs), 120);
    return () => window.clearTimeout(handle);
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
    }),
    [tabs, justOpenedPath, freshNonceByPath, addBackgroundTab, closeTab, hrefForTab, pinCurrentTab, openAppTab, openFreshPage]
  );

  return (
    <AppTabsContext.Provider value={value}>
      <Suspense fallback={null}>
        <TabUrlSync pathname={pathname} upsertTab={upsertTab} />
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
