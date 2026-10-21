'use client';

import { useCallback, useEffect, useState } from 'react';

export type WarehouseItemScope = 'all' | 'linked';

const STORAGE_KEY = 'gates:warehouse-item-scope';
const EVENT = 'gates-warehouse-item-scope';

function readScope(): WarehouseItemScope {
  if (typeof window === 'undefined') return 'all';
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'linked' ? 'linked' : 'all';
  } catch {
    return 'all';
  }
}

export function useWarehouseItemScope(): [WarehouseItemScope, (next: WarehouseItemScope) => void] {
  const [scope, setScopeState] = useState<WarehouseItemScope>('all');

  useEffect(() => {
    setScopeState(readScope());
    const onChange = () => setScopeState(readScope());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const setScope = useCallback((next: WarehouseItemScope) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota */
    }
    setScopeState(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [scope, setScope];
}
