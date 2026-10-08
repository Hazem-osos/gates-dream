'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { clearTenantContext } from '@/lib/tenant/tenant-context-storage';
import { clearPersistedOnboardingStatus } from '@/lib/onboarding/onboarding-status-cache';
import { clearConditionalGetCache } from '@/lib/api/conditional-get-cache';
import { clearTabSessionStorage } from '@/lib/navigation/tab-memory';

/**
 * Clears the token, cookie and tenant selection, then sends the user to login.
 */
export default function LogoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await apiClient.post('/auth/logout', {});
      } catch {
        // Local session is cleared even when the server is unreachable.
      }
      if (cancelled) return;
      apiClient.clearAuthToken();
      clearTenantContext();
      clearPersistedOnboardingStatus();
      clearConditionalGetCache();
      clearTabSessionStorage();
      queryClient.clear();
      router.replace('/login');
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [router, queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-600" dir="rtl">
      جاري تسجيل الخروج…
    </div>
  );
}
