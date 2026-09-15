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
import { usePathname } from 'next/navigation';
import { resolveTabLabel } from '@/lib/navigation/tab-labels';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';

export type AppTab = {
  path: string;
  label: string;
};

type AppTabsContextValue = {
  tabs: AppTab[];
  justOpenedPath: string | null;
  addBackgroundTab: (path: string) => void;
  closeTab: (path: string) => void;
};

const AppTabsContext = createContext<AppTabsContextValue | null>(null);

function toTab(path: string): AppTab {
  const normalized = normalizeAppPath(path);
  return { path: normalized, label: resolveTabLabel(normalized) };
}

export function AppTabsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [justOpenedPath, setJustOpenedPath] = useState<string | null>(null);

  const upsertTab = useCallback((path: string) => {
    const next = toTab(path);
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.path === next.path);
      if (index === -1) return [...prev, next];
      if (prev[index].label === next.label) return prev;
      return prev.map((tab, i) => (i === index ? next : tab));
    });
  }, []);

  const addBackgroundTab = useCallback(
    (path: string) => {
      const normalized = normalizeAppPath(path);
      upsertTab(normalized);
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

  useEffect(() => {
    if (pathname) upsertTab(pathname);
  }, [pathname, upsertTab]);

  const value = useMemo(
    () => ({ tabs, justOpenedPath, addBackgroundTab, closeTab }),
    [tabs, justOpenedPath, addBackgroundTab, closeTab]
  );

  return <AppTabsContext.Provider value={value}>{children}</AppTabsContext.Provider>;
}

export function useAppTabs(): AppTabsContextValue | null {
  return useContext(AppTabsContext);
}
