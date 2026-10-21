'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabPathname, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { apiClient } from '@/lib/api/client';
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import {
  readFollowUpSourceFromSearchParams,
  stripFollowUpParams,
} from '@/lib/documents/document-follow-up';
import { toast } from '@/lib/feedback/toast';

/** Loads `/invoices/sources/:type/:id` when opened via document follow-up query params. */
export function useDocumentFollowUpHydrate(opts: {
  enabled: boolean;
  isNewDocument: boolean;
  onHydrate: (payload: SourceHydratePayload) => void;
}) {
  const searchParams = useOwnTabSearchParams();
  const router = useRouter();
  const ownPathname = useOwnTabPathname();
  const appliedRef = useRef<string | null>(null);
  const onHydrateRef = useRef(opts.onHydrate);
  onHydrateRef.current = opts.onHydrate;

  useEffect(() => {
    if (!opts.enabled || !opts.isNewDocument) return;
    const follow = readFollowUpSourceFromSearchParams(searchParams);
    if (!follow) return;
    const key = `${follow.sourceType}:${follow.sourceId}`;
    if (appliedRef.current === key) return;
    appliedRef.current = key;

    void (async () => {
      try {
        const res = await apiClient.get<SourceHydratePayload>(
          `/invoices/sources/${follow.sourceType}/${follow.sourceId}`
        );
        if (res.data) onHydrateRef.current(res.data);
        const qs = stripFollowUpParams(searchParams);
        router.replace(`${ownPathname}${qs}`, { scroll: false });
      } catch (error) {
        appliedRef.current = null;
        toast.error(error instanceof Error ? error.message : 'تعذر تحميل بيانات المستند المصدر');
      }
    })();
  }, [opts.enabled, opts.isNewDocument, ownPathname, router, searchParams]);
}
