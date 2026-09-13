'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { notifyTenantContextReady } from '@/lib/tenant/tenant-context-storage';
import { refreshTenantContextFromApi } from '@/lib/tenant/refresh-tenant-context';
import { clearConditionalGetCache } from '@/lib/api/conditional-get-cache';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/logout'];

/**
 * Seeds X-Company-Id / X-Branch-Id / X-Fiscal-Year-Id from the authenticated user + API.
 * Demo catalog is opt-in (onboarding / item card) — never auto-seeded on navigation.
 */
export function TenantBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onAuthRoute = AUTH_ROUTES.some((p) => pathname === p || pathname?.startsWith(`${p}/`));

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (typeof window === 'undefined' || onAuthRoute) {
        notifyTenantContextReady();
        return;
      }

      try {
        const ctx = await refreshTenantContextFromApi();
        if (!ctx.companyId || cancelled) {
          return;
        }
        clearConditionalGetCache();
      } catch {
        // Not authenticated yet — API may still work in anonymous dev mode without stored headers
      } finally {
        if (!cancelled) {
          notifyTenantContextReady();
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [onAuthRoute, pathname]);

  return <>{children}</>;
}
