import { clearTenantContext } from '@/lib/tenant/tenant-context-storage';
import { clearPersistedOnboardingStatus } from '@/lib/onboarding/onboarding-status-cache';
import { clearConditionalGetCache } from '@/lib/api/conditional-get-cache';

export const AUTH_USER_SUB_STORAGE_KEY = 'gates_auth_user_sub';

/** Clear tenant + cached user identity when switching accounts on this browser. */
export function resetAuthSessionStorage(): void {
  clearTenantContext();
  clearPersistedOnboardingStatus();
  clearConditionalGetCache();
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(AUTH_USER_SUB_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function rememberAuthUserSub(sub: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (sub) sessionStorage.setItem(AUTH_USER_SUB_STORAGE_KEY, sub);
    else sessionStorage.removeItem(AUTH_USER_SUB_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function readRememberedAuthUserSub(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(AUTH_USER_SUB_STORAGE_KEY);
  } catch {
    return null;
  }
}
