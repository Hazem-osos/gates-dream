'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { clearTenantContext } from '@/lib/tenant/tenant-context-storage';
import { clearPersistedOnboardingStatus } from '@/lib/onboarding/onboarding-status-cache';
import { queryKeys } from '@/lib/query/query-keys';

/**
 * Clears the token, cookie and tenant selection, then sends the user to login.
 */
export default function LogoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    apiClient.clearAuthToken();
    clearTenantContext();
    clearPersistedOnboardingStatus();
    void queryClient.removeQueries({ queryKey: queryKeys.userMe });
    router.replace('/login');
    router.refresh();
  }, [router, queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-600" dir="rtl">
      جاري تسجيل الخروج…
    </div>
  );
}
