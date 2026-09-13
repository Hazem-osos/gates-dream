export const LICENSE_MODULE_CODES = [
  'ACCOUNTING',
  'INVENTORY',
  'POS',
  'MANUFACTURING',
  'CONTRACTING',
  'REAL_ESTATE',
  'SCHOOLS',
  'PAYROLL',
  'ETA',
] as const;

export type LicenseModuleCode = (typeof LICENSE_MODULE_CODES)[number];

export const SUBSCRIPTION_PLAN_TYPES = ['LIFETIME', 'SUBSCRIPTION'] as const;
export type SubscriptionPlanType = (typeof SUBSCRIPTION_PLAN_TYPES)[number];

export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIAL', 'EXPIRED', 'SUSPENDED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export function isLicenseModuleCode(value: string): value is LicenseModuleCode {
  return (LICENSE_MODULE_CODES as readonly string[]).includes(value);
}

/**
 * Route prefix → required module entitlement. Enforced centrally by `licenseRouteGate`
 * (longest prefix wins), so a new vertical is guarded by adding one line here.
 *
 * Core accounting / inventory are deliberately absent: every tenant needs them, and guarding
 * them would lock a company out of its own ledger the moment a subscription row omits them.
 */
export const ROUTE_MODULE_MAP: Record<string, LicenseModuleCode> = {
  '/api/v1/real-estate': 'REAL_ESTATE',
  '/api/v1/manufacturing': 'MANUFACTURING',
  '/api/v1/contracting': 'CONTRACTING',
  // Legacy extract surface of the same vertical — guarded so it cannot be used as a bypass.
  '/api/v1/extracts': 'CONTRACTING',
  '/api/v1/hr': 'PAYROLL',
  '/api/v1/pos': 'POS',
  // ETA covers e-invoice submission only.
  '/api/v1/electronic-invoices': 'ETA',
};
