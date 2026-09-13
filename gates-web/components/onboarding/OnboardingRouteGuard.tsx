'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOnboardingStatus } from '@/lib/hooks/useOnboardingStatus';
import { readPersistedOnboardingStatus } from '@/lib/onboarding/onboarding-status-cache';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/logout', '/share'];

export function OnboardingRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = AUTH_ROUTES.some((p) => pathname === p || pathname?.startsWith(`${p}/`));
  const isMarketingRoute = pathname === '/';
  const isOnboardingRoute = pathname === '/onboarding' || pathname?.startsWith('/onboarding/');

  const { data } = useOnboardingStatus(!isAuthRoute && !isMarketingRoute);

  const companyId = getTenantContext().companyId;
  const status = data?.data ?? readPersistedOnboardingStatus(companyId);

  useEffect(() => {
    if (isAuthRoute || isMarketingRoute || !status) return;

    if (status.isOnboarded) {
      if (isOnboardingRoute) {
        router.replace('/dashboard?tour=1');
      }
      return;
    }

    if (status.needsOnboarding || status.isOnboarded === false) {
      if (!isOnboardingRoute) {
        router.replace('/onboarding');
      }
    }
  }, [isAuthRoute, isMarketingRoute, isOnboardingRoute, status, router]);

  return <>{children}</>;
}
