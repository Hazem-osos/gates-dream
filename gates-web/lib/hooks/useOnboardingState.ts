'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { useCurrentUserProfile } from '@/lib/hooks/useCurrentUserProfile';
import { useOnboardingStatus } from '@/lib/hooks/useOnboardingStatus';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import { onboardingStatusQueryKey } from '@/lib/onboarding/onboarding-status-cache';
import {
  readVipOnboarding,
  resolveVipPersona,
  VIP_ONBOARDING_EVENT,
  writeVipOnboarding,
  type QuickWinKey,
  type VipOnboardingRecord,
  type VipPersona,
} from '@/lib/onboarding/vip-onboarding-storage';

export type { QuickWinKey, VipPersona };

function useVipStorageTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener(VIP_ONBOARDING_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(VIP_ONBOARDING_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return tick;
}

/** Lightweight flag for dashboard overlays — same localStorage record as the VIP journey. */
export function useSandboxMode() {
  const { profile } = useCurrentUserProfile();
  const tick = useVipStorageTick();
  const userId = profile?.id ?? '';
  const companyId = profile?.companyId ?? profile?.company?.id ?? '';
  return useMemo(() => {
    void tick;
    if (!userId || !companyId) return false;
    return readVipOnboarding(userId, companyId).sandbox;
  }, [userId, companyId, tick]);
}

export function useOnboardingState() {
  const { profile, displayName, isLoading: profileLoading } = useCurrentUserProfile();
  const { data: onboardingRes, isLoading: statusLoading } = useOnboardingStatus(Boolean(profile?.id));
  const invalidate = useInvalidateQuery();
  const tick = useVipStorageTick();

  const userId = profile?.id ?? '';
  const companyId = profile?.companyId ?? profile?.company?.id ?? '';
  const status = onboardingRes?.data;
  const record = useMemo(() => {
    void tick;
    return userId && companyId ? readVipOnboarding(userId, companyId) : null;
  }, [userId, companyId, tick]);

  const persist = useCallback(
    (patch: Partial<VipOnboardingRecord>) => {
      if (!userId || !companyId || !record) return;
      writeVipOnboarding(userId, companyId, { ...record, ...patch, wins: { ...record.wins, ...patch.wins } });
    },
    [userId, companyId, record]
  );

  const persona = resolveVipPersona(profile?.roles);
  const backendTourDone = Boolean(status?.hasCompletedTour);
  const profileFirstLogin =
    profile?.isFirstLogin === true || profile?.hasCompletedOnboarding === false;
  const profileOnboardingDone =
    profile?.hasCompletedOnboarding === true || profile?.isFirstLogin === false;
  const isFirstLogin =
    Boolean(profile) &&
    Boolean(status?.isOnboarded) &&
    !record?.dismissed &&
    (profileFirstLogin || (!profileOnboardingDone && !backendTourDone));

  const markTourComplete = useCallback(async () => {
    try {
      await apiClient.post('/onboarding/complete-tour');
      await invalidate(onboardingStatusQueryKey);
    } catch {
      /* local dismiss / sandbox still stands */
    }
  }, [invalidate]);

  const dismissOnboarding = useCallback(async () => {
    persist({ dismissed: true, journeyActive: true });
    await markTourComplete();
  }, [markTourComplete, persist]);

  const enableSandboxMode = useCallback(
    (active = true) => {
      persist({ sandbox: active, dismissed: true, journeyActive: true });
      if (active) void markTourComplete();
    },
    [markTourComplete, persist]
  );

  const completeQuickWin = useCallback(
    (stepKey: QuickWinKey) => {
      if (!record) return;
      persist({ wins: { ...record.wins, [stepKey]: true } });
    },
    [persist, record]
  );

  const setDockMinimized = useCallback(
    (dockMinimized: boolean) => persist({ dockMinimized }),
    [persist]
  );

  const completedWins = record ? Object.values(record.wins).filter(Boolean).length : 0;

  return {
    ready: !profileLoading && !statusLoading && Boolean(profile) && Boolean(status),
    isFirstLogin,
    showWelcome: isFirstLogin,
    sandboxMode: Boolean(record?.sandbox),
    wins: record?.wins ?? { 'print-receipt': false, 'inspect-masters': false, 'ask-ai': false },
    completedWins,
    dockMinimized: Boolean(record?.dockMinimized),
    journeyActive: Boolean(record?.journeyActive) || Boolean(record?.sandbox),
    persona,
    displayName: displayName || 'ضيف Gates',
    companyName: profile?.company?.arabicName || 'شركتك',
    dismissOnboarding,
    enableSandboxMode,
    completeQuickWin,
    setDockMinimized,
  };
}
