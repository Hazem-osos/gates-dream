'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * The setup wizard is paused. Companies sign in and work; nobody is sent to /onboarding.
 * A direct visit to that route goes to the dashboard.
 */
export function OnboardingRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isOnboardingRoute = pathname === '/onboarding' || pathname?.startsWith('/onboarding/');

  useEffect(() => {
    if (isOnboardingRoute) router.replace('/dashboard');
  }, [isOnboardingRoute, router]);

  return <>{children}</>;
}
