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

export function applyAppearanceMode(_mode: AppearanceMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.classList.remove('dark');
  root.style.colorScheme = 'light';
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

  const setMode = useCallback((_next: AppearanceMode) => {
    localStorage.setItem(STORAGE_KEY, 'light');
    setModeState('light');
    applyAppearanceMode('light');
  }, []);

  return { mode, setMode };
}
