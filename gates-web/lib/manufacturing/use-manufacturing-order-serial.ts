'use client';

import { useEffect } from 'react';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';

type NextNumberResponse = { automatic: boolean; number: string };

export function manufacturingOrderSerialQueryKey() {
  return ['manufacturing-order-next-number'] as const;
}

export function useManufacturingOrderSerial(input: {
  enabled: boolean;
  setSerial: (value: string) => void;
}) {
  const { enabled, setSerial } = input;
  const queryKey = manufacturingOrderSerialQueryKey();

  const { data: response, isFetching } = useApiQuery<NextNumberResponse>(
    queryKey,
    '/manufacturing/orders/next-number',
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
