'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiQuery, useApiMutation } from '@/lib/hooks/useApi';

export type SavedViewFilterState = Record<string, string | number | boolean | null | undefined>;

export type SavedView = {
  id: string;
  name: string;
  filters: SavedViewFilterState;
  createdAt: number;
};

type StoredSavedViews = {
  views: SavedView[];
};

function storageKey(screenKey: string) {
  return `gates:saved-views:${screenKey}`;
}

function readLocal(screenKey: string): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(screenKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredSavedViews;
    return Array.isArray(parsed.views) ? parsed.views : [];
  } catch {
    return [];
  }
}

function writeLocal(screenKey: string, views: SavedView[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(screenKey), JSON.stringify({ views }));
}

export function useSavedViews(screenKey: string) {
  const { data: prefsRes } = useApiQuery<{ savedViewsByScreen?: Record<string, SavedView[]> }>(
    ['ui-preferences-saved-views'],
    '/users/me/ui-preferences',
    undefined,
    { staleTime: 120_000 }
  );

  const savePrefsMutation = useApiMutation<unknown, { savedViewsByScreen: Record<string, SavedView[]> }>(
    '/users/me/ui-preferences',
    'PUT'
  );

  const remoteViews = prefsRes?.data?.savedViewsByScreen?.[screenKey];
  const [views, setViews] = useState<SavedView[]>(() => readLocal(screenKey));

  useEffect(() => {
    if (remoteViews?.length) {
      setViews(remoteViews);
      writeLocal(screenKey, remoteViews);
    }
  }, [remoteViews, screenKey]);

  const persist = useCallback(
    (next: SavedView[]) => {
      setViews(next);
      writeLocal(screenKey, next);
      const all = prefsRes?.data?.savedViewsByScreen ?? {};
      void savePrefsMutation.mutateAsync({
        savedViewsByScreen: { ...all, [screenKey]: next },
      }).catch(() => {
        /* local copy remains */
      });
    },
    [screenKey, prefsRes?.data?.savedViewsByScreen, savePrefsMutation]
  );

  const saveView = useCallback(
    (name: string, filters: SavedViewFilterState) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const entry: SavedView = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        filters,
        createdAt: Date.now(),
      };
      persist([entry, ...views].slice(0, 24));
    },
    [persist, views]
  );

  const removeView = useCallback(
    (id: string) => {
      persist(views.filter((v) => v.id !== id));
    },
    [persist, views]
  );

  return useMemo(
    () => ({ views, saveView, removeView, saving: savePrefsMutation.isPending }),
    [views, saveView, removeView, savePrefsMutation.isPending]
  );
}
