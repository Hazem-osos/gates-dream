'use client';

import { useEffect } from 'react';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';

type NextNumberResponse = { automatic: boolean; number: string };

export function manufacturingWorkOrderSerialQueryKey() {
  return ['manufacturing-work-order-next-number'] as const;
}

export function useManufacturingWorkOrderSerial(input: {
  enabled: boolean;
  setSerial: (value: string) => void;
}) {
  const { enabled, setSerial } = input;
  const queryKey = manufacturingWorkOrderSerialQueryKey();

  const { data: response, isFetching } = useApiQuery<NextNumberResponse>(
    queryKey,
    '/manufacturing/work-orders/next-number',
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
