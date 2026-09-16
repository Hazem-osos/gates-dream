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
  resolveAppTabHref,
  splitTabHref,
  type PersistedAppTab,
} from '@/lib/navigation/tab-memory';

export type AppTab = PersistedAppTab;

type AppTabsContextValue = {
  tabs: AppTab[];
  justOpenedPath: string | null;
  addBackgroundTab: (path: string) => void;
  closeTab: (path: string) => void;
  hrefForTab: (path: string) => string;
  pinCurrentTab: () => void;
  openAppTab: (href: string) => void;
};

const AppTabsContext = createContext<AppTabsContextValue | null>(null);

export { splitTabHref };

function toTab(input: string): AppTab {
  const { path, href } = splitTabHref(input);
  return { path, href, label: resolveTabLabel(path) };
}

export function AppTabsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [justOpenedPath, setJustOpenedPath] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadOpenTabs();
    if (stored.length) {
      setTabs((prev) => (prev.length ? prev : stored));
    }
  }, []);

  const upsertTab = useCallback((input: string, opts?: { background?: boolean }) => {
    const next = toTab(input);
    const activePath = pathname ? normalizeAppPath(pathname) : '';
    rememberTabHref(next.path, next.href);
    if (next.href.includes('?')) {
      rememberTabSearch(next.path, next.href.slice(next.href.indexOf('?') + 1));
    }
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.path === next.path);
      if (index === -1) return [...prev, next];
      const current = prev[index];
      const incomingBare = next.href === next.path;
      const existingHasDoc = current.href !== current.path;
      const keepExistingHref =
        (opts?.background || next.path !== activePath) && incomingBare && existingHasDoc;
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

  const openAppTab = useCallback(
    (href: string) => {
      pinCurrentTab();
      const dest = resolveAppTabHref(href);
      addBackgroundTab(dest);
      router.push(dest);
    },
    [addBackgroundTab, pinCurrentTab, router]
  );

  useEffect(() => {
    persistOpenTabs(tabs);
  }, [tabs]);

  useEffect(() => {
    if (!pathname) return;
    const search = searchParams.toString();
    const href = search ? `${normalizeAppPath(pathname)}?${search}` : pathname;
    upsertTab(href);
    const label = resolveTabLabel(normalizeAppPath(pathname));
    document.title = `${label} | GATES`;
    return () => {
      pinCurrentWindowHref();
    };
  }, [pathname, searchParams, upsertTab]);

  const value = useMemo(
    () => ({
      tabs,
      justOpenedPath,
      addBackgroundTab,
      closeTab,
      hrefForTab,
      pinCurrentTab,
      openAppTab,
    }),
    [tabs, justOpenedPath, addBackgroundTab, closeTab, hrefForTab, pinCurrentTab, openAppTab]
  );

  return <AppTabsContext.Provider value={value}>{children}</AppTabsContext.Provider>;
}

export function useAppTabs(): AppTabsContextValue | null {
  return useContext(AppTabsContext);
}
