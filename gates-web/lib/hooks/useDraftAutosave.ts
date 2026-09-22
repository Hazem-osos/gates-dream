'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AutosaveStatus } from '@/components/feedback/AutoSaveStatusIndicator';
import { buildDraftKey, type DraftMode } from '@/lib/drafts/draft-key';
import {
  consumeQcReturn,
  FLUSH_DRAFTS_EVENT,
  getDraftSessionId,
  readDraft,
  removeDraft,
  shouldAutoRestoreDraft,
  writeDraft,
} from '@/lib/drafts/page-drafts';
import { toast } from '@/lib/feedback/toast';
import { TabOwnPathContext } from '@/lib/navigation/tab-route-lock';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { recalledTabSearch } from '@/lib/navigation/tab-memory';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';
import { probeCount } from '@/lib/debug/gates-crash-probe';

export type UseDraftAutosaveConfig<T> = {
  documentType: string;
  variantId?: string | null;
  companyId?: string | null;
  mode?: DraftMode;
  documentId?: string | null;
  value: T;
  enabled: boolean;
  applyRestore?: (payload: T) => void;
  isEmpty?: (payload: T) => boolean;
  restoreMessage?: string;
};

function resolveCompanyId(explicit?: string | null): string {
  return String(explicit || getTenantContext().companyId || '').trim();
}

export function useDraftAutosave<T>(config: UseDraftAutosaveConfig<T>) {
  const {
    documentType,
    variantId,
    companyId: companyIdProp,
    mode = 'new',
    documentId,
    value,
    enabled,
    isEmpty,
  } = config;

  const companyId = resolveCompanyId(companyIdProp);
  const storageKey = useMemo(
    () =>
      buildDraftKey({
        companyId,
        documentType,
        mode,
        documentId,
        variantId,
      }),
    [companyId, documentId, documentType, mode, variantId]
  );
  const persistReady = Boolean(companyId) && companyId !== 'unknown';

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [restoreOffer, setRestoreOffer] = useState<T | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);
  const valueRef = useRef(value);
  const enabledRef = useRef(enabled);
  const isEmptyRef = useRef(isEmpty);
  const wasActiveRef = useRef(false);
  const isActiveRef = useRef(false);
  const clearedRef = useRef(false);
  const writeSeqRef = useRef(0);
  const restoredKeyRef = useRef('');
  const keyRef = useRef(storageKey);
  const metaRef = useRef({ companyId, documentType, mode, variantId: variantId ?? undefined });
  const applyRestoreRef = useRef(config.applyRestore);
  const restoreMessageRef = useRef(config.restoreMessage);

  valueRef.current = value;
  enabledRef.current = enabled && persistReady;
  isEmptyRef.current = isEmpty;
  keyRef.current = storageKey;
  metaRef.current = { companyId, documentType, mode, variantId: variantId ?? undefined };
  applyRestoreRef.current = config.applyRestore;
  restoreMessageRef.current = config.restoreMessage;

  const pathname = usePathname();
  const ownPath = useContext(TabOwnPathContext);
  const homePath = normalizeAppPath(ownPath || pathname || '');
  const isActive = !ownPath || !pathname || normalizeAppPath(pathname) === normalizeAppPath(ownPath);
  isActiveRef.current = isActive;

  const cancelDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const persistNow = useCallback((payload: T, force = false) => {
    probeCount('persistNow');
    if (clearedRef.current) return false;
    if (!enabledRef.current) return false;
    if (!force && isEmptyRef.current?.(payload)) return false;
    writeSeqRef.current += 1;
    const meta = metaRef.current;
    const savedAt = writeDraft(keyRef.current, payload, {
      companyId: meta.companyId,
      documentType: meta.documentType,
      mode: meta.mode,
      variantId: meta.variantId,
      writeSeq: writeSeqRef.current,
    });
    if (!savedAt) {
      setAutosaveStatus('error');
      return false;
    }
    setLastSavedAt(new Date(savedAt));
    setAutosaveStatus('saved');
    return true;
  }, []);

  const clearDraft = useCallback(() => {
    clearedRef.current = true;
    cancelDebounce();
    removeDraft(keyRef.current);
    setLastSavedAt(null);
    setRestoreOffer(null);
    setAutosaveStatus('idle');
  }, [cancelDebounce]);

  useEffect(() => {
    if (enabled && persistReady) clearedRef.current = false;
  }, [enabled, persistReady, storageKey]);

  useEffect(() => {
    restoredKeyRef.current = '';
    writeSeqRef.current = 0;
    setRestoreOffer(null);
  }, [storageKey]);

  useEffect(() => {
    if (!persistReady || !enabled) return;
    if (restoredKeyRef.current === storageKey) return;
    const parsed = readDraft<T>(storageKey);
    if (!parsed?.payload) return;
    const fromQc = consumeQcReturn(homePath);
    if (!fromQc && isEmptyRef.current?.(parsed.payload)) {
      removeDraft(storageKey);
      restoredKeyRef.current = storageKey;
      return;
    }
    if (
      !fromQc &&
      /(?:^|&)(id|invoiceId|fromInvoice|orderId|quoteId)=/i.test(recalledTabSearch(homePath))
    ) {
      restoredKeyRef.current = storageKey;
      return;
    }
    if (!fromQc && isEmptyRef.current && !isEmptyRef.current(valueRef.current)) {
      restoredKeyRef.current = storageKey;
      return;
    }

    restoredKeyRef.current = storageKey;

    const announce = restoreMessageRef.current || 'يوجد مسودة غير محفوظة على هذه الصفحة';
    if ((fromQc || shouldAutoRestoreDraft(parsed, companyId)) && applyRestoreRef.current) {
      skipNextSave.current = true;
      applyRestoreRef.current(parsed.payload);
      return;
    }

    setRestoreOffer(parsed.payload);
    toast.warning(announce, { id: 'gates-page-draft', duration: 8000 });
  }, [companyId, enabled, homePath, persistReady, storageKey]);

  useEffect(() => {
    const becameActive = isActive && !wasActiveRef.current;
    if (wasActiveRef.current && !isActive && enabledRef.current) {
      persistNow(valueRef.current, true);
    }
    wasActiveRef.current = isActive;
    if (becameActive) getDraftSessionId();
  }, [isActive, persistNow]);

  useEffect(() => {
    const onFlush = () => {
      if (!enabledRef.current || !isActiveRef.current) return;
      persistNow(valueRef.current, true);
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
      if (enabledRef.current && !clearedRef.current) {
        persistNow(valueRef.current, true);
      }
    };
  }, [persistNow]);

  useEffect(() => {
    if (!enabled || !persistReady || !isActive) {
      if (!enabled) setAutosaveStatus('idle');
      return;
    }
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (isEmptyRef.current?.(value)) {
      setAutosaveStatus('idle');
      return;
    }
    setAutosaveStatus('saving');
    cancelDebounce();
    debounceRef.current = setTimeout(() => {
      persistNow(valueRef.current);
    }, 800);
    return () => {
      cancelDebounce();
    };
  }, [cancelDebounce, enabled, isActive, persistNow, persistReady, storageKey, value]);

  const acceptRestore = useCallback(() => {
    const payload = restoreOffer;
    setRestoreOffer(null);
    skipNextSave.current = true;
    return payload;
  }, [restoreOffer]);

  const dismissRestore = useCallback(() => {
    setRestoreOffer(null);
    removeDraft(keyRef.current);
  }, []);

  return {
    lastSavedAt,
    autosaveStatus,
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
    storageKey,
  };
}
