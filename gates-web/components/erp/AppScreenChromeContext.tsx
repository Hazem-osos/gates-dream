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
};

const AppScreenChromeContext = createContext<ChromeContextValue>({
  count: 0,
  register: () => () => {},
});

export function AppScreenChromeProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const register = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => Math.max(0, n - 1));
  }, []);
  const value = useMemo(() => ({ count, register }), [count, register]);
  return <AppScreenChromeContext.Provider value={value}>{children}</AppScreenChromeContext.Provider>;
}

export function useRegisterScreenChrome() {
  const { register } = useContext(AppScreenChromeContext);
  useLayoutEffect(() => register(), [register]);
}

export function useScreenChromeCount() {
  return useContext(AppScreenChromeContext).count;
}
