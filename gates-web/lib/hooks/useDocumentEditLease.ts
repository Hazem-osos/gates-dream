'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import {
  documentLeaseSessionId,
  isDocumentOccupiedError,
} from '@/lib/concurrency/document-edit-lease';
import { useCurrentUserProfile } from '@/lib/hooks/useCurrentUserProfile';
import { useIsOwnTabActive, useOwnTabPathname } from '@/lib/navigation/tab-route-lock';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { asText } from '@/lib/text/as-text';

const silent = { skipErrorNotify: true, skipSuccessNotify: true } as const;

export function useDocumentEditLease(documentId?: string | number | null) {
  const path = useOwnTabPathname();
  const tabActive = useIsOwnTabActive();
  const { displayName } = useCurrentUserProfile();
  const [holderName, setHolderName] = useState<string | null>(null);
  const id = asText(documentId);
  const resourceKey = id ? `${normalizeAppPath(path || '')}:${id}` : '';
  const latestKey = useRef(resourceKey);
  latestKey.current = resourceKey;

  useEffect(() => {
    if (!resourceKey || !tabActive) {
      setHolderName(null);
      return;
    }

    const sessionId = documentLeaseSessionId();
    let cancelled = false;

    const acquire = async () => {
      try {
        await apiClient.post(
          '/document-edit-leases/acquire',
          {
            resourceKey,
            sessionId,
            userName: displayName || undefined,
          },
          silent
        );
        if (!cancelled && latestKey.current === resourceKey) setHolderName(null);
      } catch (error) {
        const occupied = isDocumentOccupiedError(error);
        if (!cancelled && occupied && latestKey.current === resourceKey) {
          setHolderName(occupied.holderName);
        }
      }
    };

    const release = () => {
      void apiClient.post(
        '/document-edit-leases/release',
        { resourceKey, sessionId },
        silent
      );
    };

    void acquire();
    const timer = window.setInterval(() => void acquire(), 15_000);
    window.addEventListener('pagehide', release);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', release);
      release();
    };
  }, [displayName, resourceKey, tabActive]);

  return { occupied: Boolean(holderName), holderName };
}
