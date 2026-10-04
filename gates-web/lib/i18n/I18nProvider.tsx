'use client';

import '@/lib/i18n/english-digits';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { arMessages } from './messages/ar';
import { enMessages } from './messages/en';
import type { AppDirection, AppLocale, MessageTree } from './types';

const STORAGE_KEY = 'gates:locale';
const LEGACY_MARKETING_KEY = 'gates-marketing-locale';

const MESSAGES: Record<AppLocale, MessageTree> = {
  ar: arMessages,
  en: enMessages,
};

function readStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return 'ar';
  const stored = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_MARKETING_KEY);
  return stored === 'en' || stored === 'ar' ? stored : 'ar';
}

function lookup(tree: MessageTree, path: string): string | undefined {
  const parts = path.split('.');
  let current: string | MessageTree | undefined = tree;
  for (const part of parts) {
    if (!current || typeof current === 'string') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.lang = locale;
  root.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

export type I18nContextValue = {
  locale: AppLocale;
  dir: AppDirection;
  setLocale: (next: AppLocale) => void;
  toggleLocale: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('ar');

  useEffect(() => {
    const stored = readStoredLocale();
    setLocaleState(stored);
    applyDocumentLocale(stored);
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    window.localStorage.setItem(LEGACY_MARKETING_KEY, next);
    applyDocumentLocale(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  }, [locale, setLocale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const raw = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES.ar, key) ?? key;
      return interpolate(raw, vars);
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      setLocale,
      toggleLocale,
      t,
    }),
    [locale, setLocale, toggleLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return ctx;
}

export function useOptionalI18n(): I18nContextValue | null {
  return useContext(I18nContext);
}
