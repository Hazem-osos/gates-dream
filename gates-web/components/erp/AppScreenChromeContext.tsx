'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ChromeContextValue = {
  count: number;
  register: () => () => void;
  toolbarSlot: HTMLElement | null;
  setToolbarSlot: (node: HTMLElement | null) => void;
};

const AppScreenChromeContext = createContext<ChromeContextValue>({
  count: 0,
  register: () => () => {},
  toolbarSlot: null,
  setToolbarSlot: () => {},
});

export function AppScreenChromeProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);
  const register = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => Math.max(0, n - 1));
  }, []);
  const value = useMemo(
    () => ({ count, register, toolbarSlot, setToolbarSlot }),
    [count, register, toolbarSlot]
  );
  return <AppScreenChromeContext.Provider value={value}>{children}</AppScreenChromeContext.Provider>;
}

/** Sits above the scrolling pane. Document toolbars render here so they stay put. */
export function DocumentToolbarSlot() {
  const { setToolbarSlot } = useContext(AppScreenChromeContext);
  return <div ref={setToolbarSlot} className="empty:hidden" />;
}

export function useDocumentToolbarSlot() {
  return useContext(AppScreenChromeContext).toolbarSlot;
}

export function useRegisterScreenChrome() {
  const { register } = useContext(AppScreenChromeContext);
  useLayoutEffect(() => register(), [register]);
}

export function useScreenChromeCount() {
  return useContext(AppScreenChromeContext).count;
}
