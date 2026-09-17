'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AutosaveStatus } from '@/components/feedback/AutoSaveStatusIndicator';
import {
  consumeQcReturn,
  FLUSH_DRAFTS_EVENT,
  readDraft,
  removeDraft,
  writeDraft,
} from '@/lib/drafts/page-drafts';
import { TabOwnPathContext } from '@/lib/navigation/tab-route-lock';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { recalledTabSearch } from '@/lib/navigation/tab-memory';
import { toast } from '@/lib/feedback/toast';

type DraftOptions<T> = {
  applyRestore?: (payload: T) => void;
  isEmpty?: (payload: T) => boolean;
  restoreMessage?: string;
};

export function useDraftAutosave<T>(
  storageKey: string,
  value: T,
  enabled: boolean,
  options?: DraftOptions<T>
) {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [restoreOffer, setRestoreOffer] = useState<T | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);
  const valueRef = useRef(value);
  const enabledRef = useRef(enabled);
  const optionsRef = useRef(options);
  const wasActiveRef = useRef(false);
  const isActiveRef = useRef(false);

  valueRef.current = value;
  enabledRef.current = enabled;
  optionsRef.current = options;

  const pathname = usePathname();
  const ownPath = useContext(TabOwnPathContext);
  const homePath = normalizeAppPath(ownPath || pathname || '');
  const isActive = !ownPath || !pathname || normalizeAppPath(pathname) === normalizeAppPath(ownPath);
  isActiveRef.current = isActive;

  const persistNow = useCallback(
    (payload: T) => {
      if (optionsRef.current?.isEmpty?.(payload)) return false;
      const savedAt = writeDraft(storageKey, payload);
      if (!savedAt) {
        setAutosaveStatus('error');
        return false;
      }
      setLastSavedAt(new Date(savedAt));
      setAutosaveStatus('saved');
      return true;
    },
    [storageKey]
  );

  useEffect(() => {
    const parsed = readDraft<T>(storageKey);
    if (!parsed?.payload) return;
    if (optionsRef.current?.isEmpty?.(parsed.payload)) {
      removeDraft(storageKey);
      return;
    }
    setRestoreOffer(parsed.payload);
  }, [storageKey]);

  useEffect(() => {
    const becameActive = isActive && !wasActiveRef.current;
    if (wasActiveRef.current && !isActive && enabledRef.current) {
      persistNow(valueRef.current);
    }
    wasActiveRef.current = isActive;
    if (!becameActive) return;

    const parsed = readDraft<T>(storageKey);
    if (!parsed?.payload || optionsRef.current?.isEmpty?.(parsed.payload)) return;
    if (/(?:^|&)(id|invoiceId|fromInvoice)=/i.test(recalledTabSearch(homePath))) {
      setRestoreOffer(null);
      return;
    }
    const currentEmpty = optionsRef.current?.isEmpty?.(valueRef.current) ?? false;
    if (!currentEmpty) {
      setRestoreOffer(null);
      return;
    }
    const returning = consumeQcReturn(homePath);
    const apply = optionsRef.current?.applyRestore;
    if (returning && apply) {
      skipNextSave.current = true;
      apply(parsed.payload);
      setRestoreOffer(null);
      toast.success(optionsRef.current?.restoreMessage || 'تم استعادة المسودة المحفوظة');
      return;
    }
    setRestoreOffer(parsed.payload);
  }, [homePath, isActive, persistNow, storageKey]);

  useEffect(() => {
    const onFlush = () => {
      if (!enabledRef.current || !isActiveRef.current) return;
      persistNow(valueRef.current);
    };
    window.addEventListener(FLUSH_DRAFTS_EVENT, onFlush);
    const onHide = () => {
      if (document.visibilityState === 'hidden') onFlush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onFlush);
    return () => {
      window.removeEventListener(FLUSH_DRAFTS_EVENT, onFlush);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onFlush);
    };
  }, [persistNow]);

  useEffect(() => {
    if (!enabled || !isActive) {
      if (!enabled) setAutosaveStatus('idle');
      return;
    }
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (optionsRef.current?.isEmpty?.(value)) {
      setAutosaveStatus('idle');
      return;
    }
    setAutosaveStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistNow(value);
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, isActive, persistNow, storageKey, value]);

  const acceptRestore = useCallback(() => {
    const payload = restoreOffer;
    setRestoreOffer(null);
    skipNextSave.current = true;
    return payload;
  }, [restoreOffer]);

  const dismissRestore = useCallback(() => {
    setRestoreOffer(null);
    removeDraft(storageKey);
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    removeDraft(storageKey);
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
