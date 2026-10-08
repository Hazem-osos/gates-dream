'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { resolveTabLabel } from '@/lib/navigation/tab-labels';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import {
  loadOpenTabs,
  persistOpenTabs,
  pinCurrentWindowHref,
  recalledTabHref,
  rememberTabHref,
  rememberTabSearch,
  rememberFreshPage,
  migrateTabHref,
  resolveAppTabHref,
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
  const href = migrateTabHref(input);
  const { path } = splitTabHref(href);
  return { path, href, label: resolveTabLabel(path) };
}

export function AppTabsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const router = useRouter();
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [justOpenedPath, setJustOpenedPath] = useState<string | null>(null);
  const [freshNonceByPath, setFreshNonceByPath] = useState<Record<string, number>>({});

  useEffect(() => {
    const stored = loadOpenTabs();
    if (stored.length) {
      setTabs((prev) => (prev.length ? prev : stored));
    }
  }, []);

  const upsertTab = useCallback((input: string, opts?: { background?: boolean; fresh?: boolean }) => {
    const next = toTab(input);
    const activePath = pathname ? normalizeAppPath(pathname) : '';
    rememberTabHref(next.path, next.href);
    if (next.href.includes('?')) {
      rememberTabSearch(next.path, next.href.slice(next.href.indexOf('?') + 1));
    } else if (opts?.fresh) {
      rememberTabSearch(next.path, '');
    }
    probeCount('tab state updates');
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.path === next.path);
      if (index === -1) return [...prev, next];
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
  }, [pathname]);

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

  const navigateToHref = useCallback(
    (href: string, opts?: { fresh?: boolean }) => {
      const dest = resolveAppTabHref(href);
      const path = splitTabHref(dest).path;
      flushPageDrafts();
      pinCurrentWindowHref();
      if (opts?.fresh ?? dest === path) {
        rememberFreshPage(path);
      }
      setJustOpenedPath(path);
      window.setTimeout(() => {
        setJustOpenedPath((current) => (current === path ? null : current));
      }, 1600);
      probeCount('router.push');
      probeNavUrl(`${window.location.pathname}${window.location.search}`, dest);
      router.push(dest);
    },
    [router]
  );

  const openAppTab = useCallback(
    (href: string) => {
      probeCount('openAppTab', { href });
      navigateToHref(href);
    },
    [navigateToHref]
  );

  const openFreshPage = useCallback(
    (href: string) => {
      probeCount('openFreshPage', { href });
      navigateToHref(href, { fresh: true });
    },
    [navigateToHref]
  );

  useEffect(() => {
    persistOpenTabs(tabs);
  }, [tabs]);

  useEffect(() => {
    if (!pathname) return;
    const path = normalizeAppPath(pathname);
    const href = searchString ? `${path}?${searchString}` : path;
    upsertTab(href);
    const label = resolveTabLabel(normalizeAppPath(pathname));
    document.title = `${label} | GATES`;
    return () => {
      pinCurrentWindowHref();
    };
  }, [pathname, searchString, upsertTab]);

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

  return <AppTabsContext.Provider value={value}>{children}</AppTabsContext.Provider>;
}

export function useAppTabs(): AppTabsContextValue | null {
  return useContext(AppTabsContext);
}
