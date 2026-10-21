'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AutosaveStatus } from '@/components/feedback/AutoSaveStatusIndicator';
import { buildDraftKey, buildDraftKeyWithoutUser, type DraftMode } from '@/lib/drafts/draft-key';
import {
  consumeQcReturn,
  FLUSH_DRAFTS_EVENT,
  getDraftSessionId,
  readDraft,
  recordDraftDismissal,
  removeDraft,
  wasDraftDismissed,
  writeDraft,
} from '@/lib/drafts/page-drafts';
import { useCurrentUserProfile } from '@/lib/hooks/useCurrentUserProfile';
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

const DOC_QUERY_RE = /(?:^|&)(id|invoiceId|fromInvoice|orderId|quoteId|workOrderId|bomId|modelCount)=/i;

function effectiveTabSearchForPath(homePath: string): string {
  if (typeof window === 'undefined' || !homePath) return '';
  const normalized = normalizeAppPath(homePath);
  const livePath = normalizeAppPath(window.location.pathname);
  if (livePath === normalized) {
    return window.location.search.replace(/^\?/, '') || recalledTabSearch(homePath);
  }
  return recalledTabSearch(homePath);
}

function tabMemoryHasOpenDocument(homePath: string, documentId?: string | null): boolean {
  if (documentId) return true;
  return DOC_QUERY_RE.test(effectiveTabSearchForPath(homePath));
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

  const { profile } = useCurrentUserProfile();
  const userId = String(profile?.id ?? '').trim();
  const companyId = resolveCompanyId(companyIdProp);
  const storageKey = useMemo(
    () =>
      buildDraftKey({
        companyId,
        userId,
        documentType,
        mode,
        documentId,
        variantId,
      }),
    [companyId, documentId, documentType, mode, userId, variantId]
  );
  const legacyStorageKey = useMemo(
    () =>
      buildDraftKeyWithoutUser({
        companyId,
        documentType,
        mode,
        documentId,
        variantId,
      }),
    [companyId, documentId, documentType, mode, variantId]
  );
  const persistReady = Boolean(companyId) && companyId !== 'unknown' && Boolean(userId);

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [restoreOffer, setRestoreOffer] = useState<T | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);
  const dismissedUntilEditRef = useRef(false);
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
  enabledRef.current = enabled && persistReady && restoreOffer === null;
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

  const readDraftWithMigration = useCallback((): ReturnType<typeof readDraft<T>> => {
    const current = readDraft<T>(storageKey);
    if (current?.payload) return current;
    if (!userId || legacyStorageKey === storageKey) return current;
    const legacy = readDraft<T>(legacyStorageKey);
    if (!legacy?.payload) return current;
    if (legacy.companyId && companyId && legacy.companyId !== companyId) return current;
    writeSeqRef.current += 1;
    writeDraft(storageKey, legacy.payload, {
      companyId,
      documentType,
      mode,
      variantId: variantId ?? undefined,
      writeSeq: writeSeqRef.current,
    });
    removeDraft(legacyStorageKey);
    return readDraft<T>(storageKey);
  }, [companyId, documentType, legacyStorageKey, mode, storageKey, userId, variantId]);

  const persistNow = useCallback((payload: T, _force = false) => {
    probeCount('persistNow');
    void _force;
    if (clearedRef.current) return false;
    if (dismissedUntilEditRef.current) return false;
    if (!enabledRef.current) return false;
    if (isEmptyRef.current?.(payload)) return false;
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
    const parsed = readDraftWithMigration();
    if (!parsed?.payload) return;
    if (wasDraftDismissed(storageKey, parsed.savedAt)) {
      removeDraft(storageKey);
      restoredKeyRef.current = storageKey;
      return;
    }
    const fromQc = consumeQcReturn(homePath);
    if (!fromQc && isEmptyRef.current?.(parsed.payload)) {
      removeDraft(storageKey);
      restoredKeyRef.current = storageKey;
      return;
    }
    if (!fromQc && tabMemoryHasOpenDocument(homePath, documentId)) {
      restoredKeyRef.current = storageKey;
      return;
    }
    if (!fromQc && isEmptyRef.current && !isEmptyRef.current(valueRef.current)) {
      restoredKeyRef.current = storageKey;
      return;
    }

    restoredKeyRef.current = storageKey;

    if (fromQc && applyRestoreRef.current) {
      skipNextSave.current = true;
      applyRestoreRef.current(parsed.payload);
      const announce = restoreMessageRef.current;
      if (announce) toast.success(announce, { id: 'gates-page-draft', duration: 8000 });
      return;
    }

    setRestoreOffer(parsed.payload);
  }, [companyId, documentId, enabled, homePath, persistReady, readDraftWithMigration, storageKey]);

  useEffect(() => {
    const becameActive = isActive && !wasActiveRef.current;
    if (wasActiveRef.current && !isActive && enabledRef.current) {
      persistNow(valueRef.current, true);
    }
    if (becameActive && enabledRef.current) {
      const parsed = readDraft<T>(keyRef.current) ?? readDraft<T>(legacyStorageKey);
      const payload = parsed?.payload;
      const empty = payload != null && isEmptyRef.current?.(payload);
      const currentEmpty = !isEmptyRef.current || isEmptyRef.current(valueRef.current);
      const hasDocInUrl = tabMemoryHasOpenDocument(homePath, documentId);
      if (
        payload != null &&
        !empty &&
        parsed &&
        !hasDocInUrl &&
        currentEmpty &&
        !wasDraftDismissed(keyRef.current, parsed.savedAt)
      ) {
        setRestoreOffer(payload);
      }
    }
    wasActiveRef.current = isActive;
    if (becameActive) getDraftSessionId();
  }, [documentId, homePath, isActive, legacyStorageKey, persistNow]);

  useEffect(() => {
    const onFlush = () => {
      if (!enabledRef.current) return;
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
    if (dismissedUntilEditRef.current) {
      if (isEmptyRef.current?.(value)) {
        setAutosaveStatus('idle');
        return;
      }
      dismissedUntilEditRef.current = false;
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
  }, [cancelDebounce, enabled, isActive, persistNow, persistReady, restoreOffer, storageKey, value]);

  const acceptRestore = useCallback(() => {
    const payload = restoreOffer;
    setRestoreOffer(null);
    skipNextSave.current = true;
    return payload;
  }, [restoreOffer]);

  const dismissRestore = useCallback(() => {
    const parsed = readDraft<T>(keyRef.current);
    if (parsed?.savedAt) recordDraftDismissal(keyRef.current, parsed.savedAt);
    skipNextSave.current = true;
    dismissedUntilEditRef.current = true;
    setRestoreOffer(null);
    removeDraft(keyRef.current, { keepDismissal: true });
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
