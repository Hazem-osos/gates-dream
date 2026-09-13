'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'gates:command-recent:v1';

export type RecentEntry = {
  id: string;
  label: string;
  href: string;
  at: number;
};

function readRecent(): RecentEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useCommandRecent() {
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  const pushRecent = useCallback((entry: Omit<RecentEntry, 'at'>) => {
    const list = readRecent().filter((r) => r.href !== entry.href);
    const next = [{ ...entry, at: Date.now() }, ...list].slice(0, 8);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setRecent(next);
  }, []);

  return { recent: recent.slice(0, 5), pushRecent };
}

export function getRecentForPalette(): RecentEntry[] {
  return readRecent().slice(0, 5);
}
