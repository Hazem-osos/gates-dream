'use client';

import { useCallback, useEffect, useState } from 'react';

export type AppearanceMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'gates:appearance-mode';

function readStored(): AppearanceMode {
  if (typeof window === 'undefined') return 'system';
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyAppearanceMode(mode: AppearanceMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  const dark =
    mode === 'dark' ? true : mode === 'light' ? false : systemPrefersDark();
  root.classList.toggle('dark', dark);
}

export function useAppearanceMode() {
  const [mode, setModeState] = useState<AppearanceMode>('system');

  useEffect(() => {
    const stored = readStored();
    setModeState(stored);
    applyAppearanceMode(stored);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => {
      if (readStored() === 'system') applyAppearanceMode('system');
    };
    mq.addEventListener('change', onSystem);
    return () => mq.removeEventListener('change', onSystem);
  }, []);

  const setMode = useCallback((next: AppearanceMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
    applyAppearanceMode(next);
  }, []);

  return { mode, setMode };
}
