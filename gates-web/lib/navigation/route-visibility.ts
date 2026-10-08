/**
 * Screens that are parked or not ready for daily use.
 * Sidebars, the command palette, and the module switcher skip these URLs.
 * Opening one directly shows the Arabic unavailable page.
 */

const HIDDEN_PREFIXES = [
  '/importexport',
  '/schools',
  '/taxes',
  '/accounting/account-reports/analysis/operations-analysis',
  '/accounting/guide/cost-center-search',
  '/accounting/cards/delegate-group',
  // BOM list placeholder — use نموذج التصنيع for stages
  '/manufacturing/creations/manufacturing-stages',
  '/real-estate-investment/create/sales-employees',
  '/real-estate-investment/create/marketing-channels',
  '/real-estate-investment/create/unit-sale-others',
  '/real-estate-investment/create/unit-sale-private',
  '/hr/employee-attendance-preview',
  '/hr/annual-leave-entitlements-clearance',
  '/hr/end-of-service-entitlements-clearance',
  '/hr/housing-allowance-clearance',
  '/hr/transaction-models',
  '/hr/transaction-tracking',
  // تسوية مخزنية — removed from product navigation; use جرد مخزني instead.
  '/inventory/operations/adjustment',
] as const;

export const HIDDEN_MODULE_KEYS = new Set(['importexport']);

function normalizePath(pathname: string): string {
  const path = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

export function isRouteUnavailable(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = normalizePath(pathname);
  return HIDDEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
