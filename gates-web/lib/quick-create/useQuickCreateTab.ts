'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  completeQuickCreate,
  consumeQuickCreateResult,
  storeQuickCreateRequest,
  subscribeQuickCreate,
} from './bridge';
import {
  QUICK_CREATE_PATHS,
  type QuickCreateEntity,
  type QuickCreateKind,
} from './catalog';

export function useOpenQuickCreateTab(
  kind: QuickCreateKind,
  onCreated: (entity: QuickCreateEntity) => void
) {
  const router = useRouter();
  const pathname = usePathname();
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

    const pending = requestIdRef.current;
    if (pending) apply(pending);

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
      storeQuickCreateRequest({
        id,
        kind,
        returnPath: pathname || '/',
        prefillName: prefillName?.trim() || undefined,
      });
      const qs = new URLSearchParams({ qc: id });
      if (prefillName?.trim()) qs.set('qcName', prefillName.trim());
      router.push(`${QUICK_CREATE_PATHS[kind]}?${qs.toString()}`);
    },
    [kind, pathname, router]
  );
}

export function useQuickCreateHost(kind: QuickCreateKind) {
  const router = useRouter();
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
      if (returnPath) router.push(returnPath);
    },
    [kind, router]
  );

  return { isQuickCreate, prefillName, complete };
}
