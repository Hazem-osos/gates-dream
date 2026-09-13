import type { QueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '@/lib/api/types';
import type { OnboardingStatus } from '@/lib/hooks/useOnboardingStatus';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';

export const onboardingStatusQueryKey = ['/onboarding/status'] as const;

const STORAGE_KEY = 'gates_onboarding_status_v1';

type PersistedOnboarding = {
  companyId: string;
  status: OnboardingStatus;
  savedAt: string;
};

const DEFAULT_CHECKLIST: OnboardingStatus['launchChecklist'] = {
  createdFirstInvoice: false,
  addedFirstCustomer: false,
  createdFirstItem: false,
  recordedFirstReceipt: false,
  dismissed: false,
  companySetupComplete: true,
};

function readRaw(): PersistedOnboarding | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedOnboarding;
    if (!parsed?.companyId || !parsed.status) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readPersistedOnboardingStatus(companyId: string | null): OnboardingStatus | null {
  if (!companyId) return null;
  const row = readRaw();
  if (!row || row.companyId !== companyId) return null;
  return row.status;
}

export function persistOnboardingStatus(companyId: string, status: OnboardingStatus): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedOnboarding = {
      companyId,
      status,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPersistedOnboardingStatus(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function onboardingStatusPlaceholder(
  companyId: string | null
): ApiResponse<OnboardingStatus> | undefined {
  const status = readPersistedOnboardingStatus(companyId);
  if (!status) return undefined;
  return { status: 'success', data: status };
}

/** After bootstrap wizard, keep the route guard from sending the user back to /onboarding. */
export function markOnboardingCompleteInCache(queryClient: QueryClient): void {
  const companyId = getTenantContext().companyId;
  const data: OnboardingStatus = {
    isOnboarded: true,
    needsOnboarding: false,
    onboardedAt: new Date().toISOString(),
    onboardingStep: 5,
    hasCompletedTour: false,
    hasCreatedFirstInvoice: false,
    launchChecklist: DEFAULT_CHECKLIST,
  };
  const payload = { status: 'success' as const, data };
  queryClient.setQueryData([...onboardingStatusQueryKey, undefined], payload);
  if (companyId) persistOnboardingStatus(companyId, data);
}
