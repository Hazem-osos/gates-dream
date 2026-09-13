'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { dispatchAcademyCheckpoint } from '@/lib/onboarding/tourCheckpoints';

const STORAGE_KEY = 'gates:privacy_mode';

type PrivacyContextValue = {
  privacyMode: boolean;
  togglePrivacyMode: () => void;
};

const PrivacyModeContext = createContext<PrivacyContextValue>({
  privacyMode: false,
  togglePrivacyMode: () => {},
});

export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState(false);
  const privacyInit = useRef(false);

  useEffect(() => {
    try {
      setPrivacyMode(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('gates-privacy-mode', privacyMode);
    try {
      localStorage.setItem(STORAGE_KEY, privacyMode ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [privacyMode]);

  useEffect(() => {
    if (!privacyInit.current) {
      privacyInit.current = true;
      return;
    }
    dispatchAcademyCheckpoint('privacy-toggle');
  }, [privacyMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setPrivacyMode((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const togglePrivacyMode = useCallback(() => setPrivacyMode((v) => !v), []);

  return (
    <PrivacyModeContext.Provider value={{ privacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyMode() {
  return useContext(PrivacyModeContext);
}
