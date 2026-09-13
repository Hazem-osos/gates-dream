'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AutosaveStatus } from '@/components/feedback/AutoSaveStatusIndicator';

type DraftEnvelope<T> = {
  savedAt: string;
  payload: T;
};

export function useDraftAutosave<T>(storageKey: string, value: T, enabled: boolean) {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [restoreOffer, setRestoreOffer] = useState<T | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraftEnvelope<T>;
      if (parsed?.payload) setRestoreOffer(parsed.payload);
    } catch {
      /* ignore */
    }
  }, [storageKey, enabled]);

  useEffect(() => {
    if (!enabled) {
      setAutosaveStatus('idle');
      return;
    }
    if (typeof window === 'undefined') return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setAutosaveStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        const envelope: DraftEnvelope<T> = {
          savedAt: new Date().toISOString(),
          payload: value,
        };
        localStorage.setItem(storageKey, JSON.stringify(envelope));
        setLastSavedAt(new Date());
        setAutosaveStatus('saved');
      } catch {
        setAutosaveStatus('error');
      }
    }, 3000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [storageKey, value, enabled]);

  const acceptRestore = useCallback(() => {
    const payload = restoreOffer;
    setRestoreOffer(null);
    skipNextSave.current = true;
    return payload;
  }, [restoreOffer]);

  const dismissRestore = useCallback(() => {
    setRestoreOffer(null);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setLastSavedAt(null);
    setRestoreOffer(null);
    setAutosaveStatus('idle');
  }, [storageKey]);

  return {
    lastSavedAt,
    autosaveStatus,
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  };
}
