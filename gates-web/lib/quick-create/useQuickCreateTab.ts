'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  completeQuickCreate,
  consumeQuickCreateResult,
  peekPendingRequestId,
  storeQuickCreateRequest,
  subscribeQuickCreate,
} from './bridge';
import { flushPageDrafts, markQcReturn } from '@/lib/drafts/page-drafts';
import {
  QUICK_CREATE_PATHS,
  type QuickCreateEntity,
  type QuickCreateKind,
} from './catalog';
import { destinationAppTabHref, pinCurrentWindowHref } from '@/lib/navigation/tab-memory';
import { bumpMasterCatalog, invalidateMasterCatalog } from '@/lib/query/master-catalog-sync';
import { useAppTabs } from '@/app/components/AppTabsContext';

export function useOpenQuickCreateTab(
  kind: QuickCreateKind,
  onCreated: (entity: QuickCreateEntity) => void
) {
  const router = useRouter();
  const pathname = usePathname();
  const tabs = useAppTabs();
  const requestIdRef = useRef<string | null>(null);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  useEffect(() => {
    const apply = (requestId: string) => {
      const result = consumeQuickCreateResult(requestId);
      if (!result || result.kind !== kind) return;
      onCreatedRef.current(result.entity);
      requestIdRef.current = null;
    };

    const pending = requestIdRef.current || peekPendingRequestId(kind);
    if (pending) {
      requestIdRef.current = pending;
      apply(pending);
    }

    return subscribeQuickCreate((result) => {
      if (requestIdRef.current && result.requestId !== requestIdRef.current) return;
      if (result.kind !== kind) return;
      apply(result.requestId);
    });
  }, [kind]);

  return useCallback(
    (prefillName?: string) => {
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `qc-${Date.now()}`;
      requestIdRef.current = id;
      const returnPath =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : pathname || '/';
      storeQuickCreateRequest({
        id,
        kind,
        returnPath,
        prefillName: prefillName?.trim() || undefined,
      });
      flushPageDrafts();
      markQcReturn(pathname || '/');
      pinCurrentWindowHref();
      tabs?.pinCurrentTab();
      const qs = new URLSearchParams({ qc: id });
      if (prefillName?.trim()) qs.set('qcName', prefillName.trim());
      const href = `${QUICK_CREATE_PATHS[kind]}?${qs.toString()}`;
      if (tabs) {
        tabs.openAppTab(href);
        return;
      }
      router.push(destinationAppTabHref(href));
    },
    [kind, pathname, router, tabs]
  );
}

export function useQuickCreateHost(kind: QuickCreateKind) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [prefillName, setPrefillName] = useState('');
  const [isQuickCreate, setIsQuickCreate] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsQuickCreate(Boolean(params.get('qc')));
    setPrefillName(params.get('qcName')?.trim() || '');
  }, []);

  const complete = useCallback(
    (entity: QuickCreateEntity) => {
      const returnPath = completeQuickCreate(kind, entity);
      bumpMasterCatalog(kind);
      invalidateMasterCatalog(queryClient, kind);
      if (returnPath) router.push(destinationAppTabHref(returnPath));
    },
    [kind, queryClient, router]
  );

  return { isQuickCreate, prefillName, complete };
}
