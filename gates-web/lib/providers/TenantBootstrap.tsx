'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  setTenantContext,
  getTenantContext,
  clearTenantContext,
  notifyTenantContextReady,
} from '@/lib/tenant/tenant-context-storage';
import { invalidateMasterDataClient } from '@/lib/hooks/invalidateMasterData';
import { clearConditionalGetCache } from '@/lib/api/conditional-get-cache';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/logout'];

type BranchRow = { id: string; isActive?: boolean };
type MeProfile = {
  companyId: string | null;
  branchId: string | null;
  branches?: { id: string }[];
};
type FiscalYearRow = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
};

/**
 * Seeds X-Company-Id / X-Branch-Id / X-Fiscal-Year-Id from the authenticated user + API.
 */
export function TenantBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const onAuthRoute = AUTH_ROUTES.some((p) => pathname === p || pathname?.startsWith(`${p}/`));

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (typeof window === 'undefined' || onAuthRoute) {
        notifyTenantContextReady();
        return;
      }

      const onOnboardingRoute = pathname === '/onboarding' || pathname?.startsWith('/onboarding/');

      try {
        const meRes = await apiClient.get<MeProfile>('/users/me');
        const userCompanyId = meRes.data?.companyId ?? null;
        if (!userCompanyId || cancelled) {
          return;
        }

        const existing = getTenantContext();
        const companyChanged = Boolean(existing.companyId && existing.companyId !== userCompanyId);
        if (companyChanged) {
          clearTenantContext();
          clearConditionalGetCache();
        }

        setTenantContext({ companyId: userCompanyId });
        if (!cancelled) {
          notifyTenantContextReady();
        }

        let branchId = companyChanged ? null : existing.branchId;
        let fiscalYearId = companyChanged ? null : existing.fiscalYearId;

        const [branchesRes, fyRes] = await Promise.all([
          apiClient.get<BranchRow[]>('/company/branches', { page: 1, limit: 50 }),
          apiClient.get<FiscalYearRow[]>('/company/fiscal-years', { page: 1, limit: 50 }),
        ]);

        const branches = branchesRes.data ?? [];
        const branchIds = new Set(branches.map((b) => b.id));
        const meBranch = meRes.data?.branchId;
        const mePermitted = meRes.data?.branches ?? [];
        if (meBranch && branchIds.has(meBranch)) {
          branchId = meBranch;
        } else {
          const fromPermissions = mePermitted.find((b) => branchIds.has(b.id))?.id;
          if (fromPermissions) {
            branchId = fromPermissions;
          } else if (!branchId || !branchIds.has(branchId)) {
            branchId =
              branches.find((b) => b.isActive !== false)?.id ?? branches[0]?.id ?? null;
          }
        }

        const years = fyRes.data ?? [];
        const yearIds = new Set(years.map((y) => y.id));
        if (!fiscalYearId || !yearIds.has(fiscalYearId)) {
          const today = new Date();
          const openCovering = years.find((y) => {
            if (y.status === 'Close') return false;
            const start = new Date(y.startDate);
            const end = new Date(y.endDate);
            return start <= today && end >= today;
          });
          const openAny = years.find((y) => y.status !== 'Close');
          fiscalYearId = openCovering?.id ?? openAny?.id ?? years[0]?.id ?? null;
        }

        if (!cancelled) {
          setTenantContext({
            companyId: userCompanyId,
            branchId: branchId ?? null,
            fiscalYearId: fiscalYearId ?? null,
          });
          notifyTenantContextReady();
        }

        if (!onOnboardingRoute && !cancelled) {
          void (async () => {
            try {
              const itemsRes = await apiClient.get<{ serial?: string }[]>('/inventory/items', {
                limit: 50,
                isActive: true,
              });
              const rows = itemsRes.data ?? [];
              const hasDemo = rows.some((i) => i.serial === 'ITEM-01');
              if (!hasDemo) {
                await apiClient.post('/inventory/items/seed-demo-catalog', {});
                if (!cancelled) {
                  invalidateMasterDataClient(queryClient);
                }
              }
            } catch {
              // Non-fatal — user can seed from item card / API
            }
          })();
        }
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
  }, [onAuthRoute, pathname, queryClient]);

  return <>{children}</>;
}
