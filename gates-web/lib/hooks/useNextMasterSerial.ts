'use client';

import { useApiQuery } from '@/lib/hooks/useApi';

export function useNextMasterSerial(queryKey: readonly unknown[], url: string, enabled: boolean) {
  return useApiQuery<{ serial: string }>(queryKey, url, undefined, {
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
