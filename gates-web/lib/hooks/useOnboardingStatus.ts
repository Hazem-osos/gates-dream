'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from './useApi';
import {
  onboardingStatusQueryKey,
  onboardingStatusPlaceholder,
  persistOnboardingStatus,
} from '@/lib/onboarding/onboarding-status-cache';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';

export type LaunchChecklistState = {
  createdFirstInvoice: boolean;
  addedFirstCustomer: boolean;
  createdFirstItem: boolean;
  recordedFirstReceipt: boolean;
  dismissed?: boolean;
  companySetupComplete?: boolean;
};

export type OnboardingStatus = {
  isOnboarded: boolean;
  onboardedAt: string | null;
  onboardingStep: number;
  hasCompletedTour: boolean;
  hasCreatedFirstInvoice: boolean;
  launchChecklist: LaunchChecklistState;
  needsOnboarding: boolean;
};

export function useOnboardingStatus(enabled = true) {
  const companyId = getTenantContext().companyId;
  const queryClient = useQueryClient();
  const seededPlaceholderRef = useRef(false);

  const query = useApiQuery<OnboardingStatus>(
    onboardingStatusQueryKey,
    '/onboarding/status',
    undefined,
    {
      enabled,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );

  // Sessionstorage placeholder must NOT feed the first render (server has no
  // `window`, so reading it synchronously via `placeholderData` diverges the
  // client's initial hydration pass from the server-rendered HTML). Seeding
  // it here, after mount, is a normal post-hydration cache update instead.
  useEffect(() => {
    if (seededPlaceholderRef.current) return;
    seededPlaceholderRef.current = true;
    if (query.data?.data) return;
    const placeholder = onboardingStatusPlaceholder(companyId);
    if (placeholder) {
      queryClient.setQueryData([...onboardingStatusQueryKey, undefined], placeholder);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    const status = query.data?.data;
    if (status && companyId) {
      persistOnboardingStatus(companyId, status);
    }
  }, [query.data?.data, companyId]);

  return query;
}

export { onboardingStatusQueryKey };
