'use client';

import { useEffect } from 'react';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';

export type StoreDocumentSerialKind =
  | 'stocktaking'
  | 'transfer'
  | 'adjustment'
  | 'receipt'
  | 'issue'
  | 'other-adjustment'
  | 'assembly'
  | 'disassembly';

type NextNumberResponse = { automatic: boolean; number: string };

export function storeDocumentNextNumberQueryKey(kind: StoreDocumentSerialKind) {
  return ['store-document-next-number', kind] as const;
}

/**
 * Preview the next store-document serial and seed the form on new documents.
 * When company settings use automatic numbering, the serial field should be read-only.
 */
export function useStoreDocumentSerial(input: {
  kind: StoreDocumentSerialKind;
  /** False when editing an existing saved document. */
  enabled: boolean;
  setSerial: (value: string) => void;
}) {
  const { kind, enabled, setSerial } = input;
  const queryKey = storeDocumentNextNumberQueryKey(kind);

  const { data: response, isFetching } = useApiQuery<NextNumberResponse>(
    queryKey,
    `/inventory/store-documents/next-number?kind=${encodeURIComponent(kind)}`,
    undefined,
    { enabled, staleTime: 0 }
  );

  const automatic = response?.data?.automatic !== false;
  const nextSerial = response?.data?.number?.trim() || '';

  useEffect(() => {
    if (!enabled || !nextSerial) return;
    setSerial(nextSerial);
  }, [enabled, nextSerial, setSerial]);

  const invalidateQuery = useInvalidateQuery();

  return {
    serialAutomatic: automatic,
    nextSerial,
    serialLoading: isFetching,
    invalidateNextSerial: () => invalidateQuery(queryKey),
  };
}

/** Status chip for unposted store vouchers (not a draft workflow). */
export const STORE_DOCUMENT_UNPOSTED_LABEL = 'غير مرحّل';
