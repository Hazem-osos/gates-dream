export const TENANT_CONTEXT_READY_EVENT = 'gates:tenant-context-ready';

const STORAGE_KEYS = {
  companyId: 'gates_tenant_company_id',
  branchId: 'gates_tenant_branch_id',
  fiscalYearId: 'gates_tenant_fiscal_year_id',
} as const;

export type TenantContextSnapshot = {
  companyId: string | null;
  branchId: string | null;
  fiscalYearId: string | null;
};

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

function write(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

export function getTenantContext(): TenantContextSnapshot {
  return {
    companyId: read(STORAGE_KEYS.companyId),
    branchId: read(STORAGE_KEYS.branchId),
    fiscalYearId: read(STORAGE_KEYS.fiscalYearId),
  };
}

export function setTenantContext(partial: Partial<TenantContextSnapshot>): void {
  if (partial.companyId !== undefined) write(STORAGE_KEYS.companyId, partial.companyId);
  if (partial.branchId !== undefined) write(STORAGE_KEYS.branchId, partial.branchId);
  if (partial.fiscalYearId !== undefined) write(STORAGE_KEYS.fiscalYearId, partial.fiscalYearId);
}

export function clearTenantContext(): void {
  write(STORAGE_KEYS.companyId, null);
  write(STORAGE_KEYS.branchId, null);
  write(STORAGE_KEYS.fiscalYearId, null);
}

/** Fired once tenant bootstrap finishes (success or best-effort). */
export function notifyTenantContextReady(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TENANT_CONTEXT_READY_EVENT));
}

export function isTenantContextSeeded(): boolean {
  const ctx = getTenantContext();
  return Boolean(ctx.companyId && ctx.branchId && ctx.fiscalYearId);
}

export function isOnboardingApiPath(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return path === '/onboarding' || path.startsWith('/onboarding/');
}

/** Mutations: onboarding only needs company (branch/FY created by bootstrap). */
export function isMutationTenantReady(url: string, ctx: TenantContextSnapshot): boolean {
  const path = url.split('?')[0] ?? url;
  if (path === '/users/me' || path.startsWith('/users/me/')) return Boolean(ctx.companyId);
  if (isOnboardingApiPath(url)) return Boolean(ctx.companyId);
  return Boolean(ctx.companyId && ctx.branchId && ctx.fiscalYearId);
}

export function buildTenantRequestHeaders(
  method: string,
  attachOnGet: boolean
): Record<string, string> {
  const ctx = getTenantContext();
  const headers: Record<string, string> = {};
  const mutating = method !== 'GET' && method !== 'HEAD';
  if (!mutating && !attachOnGet) return headers;

  if (ctx.companyId) headers['X-Company-Id'] = ctx.companyId;
  if (ctx.branchId) headers['X-Branch-Id'] = ctx.branchId;
  if (ctx.fiscalYearId) headers['X-Fiscal-Year-Id'] = ctx.fiscalYearId;
  return headers;
}
