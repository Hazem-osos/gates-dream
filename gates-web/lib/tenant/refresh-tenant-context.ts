import { apiClient } from '@/lib/api/client';
import {
  clearTenantContext,
  getTenantContext,
  notifyTenantContextReady,
  setTenantContext,
  type TenantContextSnapshot,
} from '@/lib/tenant/tenant-context-storage';

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
 * Re-reads branch + fiscal year from the API and writes X-* tenant headers.
 * Used after first-time company basics and after seeding the chart of accounts.
 */
export async function refreshTenantContextFromApi(): Promise<TenantContextSnapshot> {
  const meRes = await apiClient.get<MeProfile>('/users/me');
  const userCompanyId = meRes.data?.companyId ?? null;
  if (!userCompanyId) {
    notifyTenantContextReady();
    return getTenantContext();
  }

  const existing = getTenantContext();
  const companyChanged = Boolean(existing.companyId && existing.companyId !== userCompanyId);
  if (companyChanged) {
    clearTenantContext();
  }

  setTenantContext({ companyId: userCompanyId });

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
      branchId = branches.find((b) => b.isActive !== false)?.id ?? branches[0]?.id ?? null;
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

  setTenantContext({
    companyId: userCompanyId,
    branchId: branchId ?? null,
    fiscalYearId: fiscalYearId ?? null,
  });
  notifyTenantContextReady();
  return getTenantContext();
}
