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

/** Company identity / first branch / fiscal year / COA seed — only company header is required. */
export function isCompanyBootstrapApiPath(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return (
    path === '/company/current' ||
    path === '/company/basics' ||
    path === '/company/branches' ||
    path === '/company/fiscal-years' ||
    path.startsWith('/company/onboarding') ||
    path === '/accounting/settings' ||
    path === '/accounting/accounts/seed-defaults' ||
    path === '/accounting/accounts/seed-default-coa' ||
    path.startsWith('/accounting/accounts/seed-')
  );
}

/**
 * Master cards / guides (warehouses, items, COA, units) are company-scoped.
 * They must work before a fiscal year exists — FY is only required for posting.
 */
export function isMasterCatalogApiPath(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return (
    path.startsWith('/inventory/warehouses') ||
    path.startsWith('/inventory/items') ||
    path.startsWith('/inventory/item-categories') ||
    path.startsWith('/inventory/item-units') ||
    path.startsWith('/inventory/units') ||
    path.startsWith('/inventory/price-lists') ||
    path.startsWith('/inventory/item-prices') ||
    path.startsWith('/inventory/item-quantities') ||
    path.startsWith('/inventory/item-order-limits') ||
    path.startsWith('/inventory/clothing-matrix') ||
    path.startsWith('/accounting/accounts') ||
    path.startsWith('/accounting/cost-centers') ||
    path.startsWith('/accounting/currencies')
  );
}

/** Mutations: onboarding, first-time setup, and master catalogs only need company. */
export function isMutationTenantReady(url: string, ctx: TenantContextSnapshot): boolean {
  const path = url.split('?')[0] ?? url;
  if (path === '/users/me' || path.startsWith('/users/me/')) return Boolean(ctx.companyId);
  if (isOnboardingApiPath(url)) return Boolean(ctx.companyId);
  if (isCompanyBootstrapApiPath(url)) return Boolean(ctx.companyId);
  if (isMasterCatalogApiPath(url)) return Boolean(ctx.companyId);
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
