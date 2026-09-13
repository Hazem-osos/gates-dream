'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';

const STORAGE_KEY = 'gates:page-favorites:v1';

export type PageFavorite = {
  href: string;
  label: string;
  starredAt: number;
};

function readFavorites(): PageFavorite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PageFavorite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFavoritesLocal(list: PageFavorite[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 40)));
  window.dispatchEvent(new CustomEvent('gates:favorites-changed'));
}

function mergeFavoriteLists(server: PageFavorite[], local: PageFavorite[]): PageFavorite[] {
  const byHref = new Map<string, PageFavorite>();
  for (const f of server) byHref.set(f.href, f);
  for (const f of local) {
    if (!byHref.has(f.href)) byHref.set(f.href, f);
  }
  return [...byHref.values()]
    .sort((a, b) => b.starredAt - a.starredAt)
    .slice(0, 40);
}

export function usePageFavorites() {
  const [favorites, setFavorites] = useState<PageFavorite[]>([]);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedFromServer = useRef(false);

  const { data: prefsResponse } = useApiQuery<{ pageFavorites: PageFavorite[] }>(
    ['user-ui-preferences'],
    '/users/me/ui-preferences',
    undefined,
    { retry: false, staleTime: 60_000 }
  );

  useEffect(() => {
    setFavorites(readFavorites());
    const onChange = () => setFavorites(readFavorites());
    window.addEventListener('gates:favorites-changed', onChange);
    return () => window.removeEventListener('gates:favorites-changed', onChange);
  }, []);

  useEffect(() => {
    const serverList = prefsResponse?.data?.pageFavorites;
    if (!serverList || hydratedFromServer.current) return;
    hydratedFromServer.current = true;
    const merged = mergeFavoriteLists(serverList, readFavorites());
    writeFavoritesLocal(merged);
    setFavorites(merged);
    if (merged.length !== serverList.length) {
      void apiClient.put('/users/me/ui-preferences', { pageFavorites: merged });
    }
  }, [prefsResponse]);

  const scheduleSync = useCallback((list: PageFavorite[]) => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      void apiClient.put('/users/me/ui-preferences', { pageFavorites: list }).catch(() => {
        /* offline — localStorage remains source until next session */
      });
    }, 800);
  }, []);

  const isFavorite = useCallback(
    (href: string) => favorites.some((f) => f.href === href),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (href: string, label: string) => {
      const current = readFavorites();
      const exists = current.find((f) => f.href === href);
      const next = exists
        ? current.filter((f) => f.href !== href)
        : [{ href, label, starredAt: Date.now() }, ...current];
      writeFavoritesLocal(next);
      setFavorites(next);
      scheduleSync(next);
    },
    [scheduleSync]
  );

  return { favorites, isFavorite, toggleFavorite };
}
