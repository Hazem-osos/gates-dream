'use client';

import { useEffect, useState } from 'react';
import {
  TENANT_CONTEXT_READY_EVENT,
  isTenantContextSeeded,
  getTenantContext,
} from '@/lib/tenant/tenant-context-storage';

/**
 * True after TenantBootstrap completes so mutating requests include branch + fiscal headers.
 */
export function useTenantContextReady(): boolean {
  // Always start `false` (matches SSR) — the client would otherwise read
  // localStorage synchronously during the first render and mismatch the
  // server-rendered HTML, triggering a hydration error. The effect below
  // syncs the real value immediately after mount instead.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isTenantContextSeeded()) {
      setReady(true);
      return;
    }
    const onReady = () => setReady(isTenantContextSeeded());
    window.addEventListener(TENANT_CONTEXT_READY_EVENT, onReady);
    return () => window.removeEventListener(TENANT_CONTEXT_READY_EVENT, onReady);
  }, []);

  return ready;
}

/** True when X-Company-Id is available (read-only dashboards / analytics). */
export function useCompanyContextReady(): boolean {
  // See note in useTenantContextReady — must start `false` to match SSR.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setReady(Boolean(getTenantContext().companyId));
    sync();
    window.addEventListener(TENANT_CONTEXT_READY_EVENT, sync);
    return () => window.removeEventListener(TENANT_CONTEXT_READY_EVENT, sync);
  }, []);

  return ready;
}
