import type { NotificationCategory } from '@prisma/client';

/** Canonical roles used on AiNotification.targetRoles. */
export const SENTINEL_ROLES = [
  'OWNER',
  'SUPER_ADMIN',
  'FINANCIAL_DIRECTOR',
  'ACCOUNTANT',
  'WAREHOUSE_KEEPER',
  'PURCHASING_MANAGER',
  'SALES_MANAGER',
  'SALES_REP',
] as const;

export type SentinelRole = (typeof SENTINEL_ROLES)[number];

const ROLE_RANK: Record<SentinelRole, number> = {
  SALES_REP: 1,
  WAREHOUSE_KEEPER: 2,
  PURCHASING_MANAGER: 2,
  ACCOUNTANT: 3,
  SALES_MANAGER: 3,
  FINANCIAL_DIRECTOR: 4,
  SUPER_ADMIN: 5,
  OWNER: 5,
};

export const CATEGORY_TARGET_ROLES: Record<NotificationCategory, readonly SentinelRole[]> = {
  FINANCIAL_LIQUIDITY: ['OWNER', 'SUPER_ADMIN', 'FINANCIAL_DIRECTOR'],
  PROFIT_ANOMALY: ['OWNER', 'SUPER_ADMIN'],
  CHEQUE_DUE: ['ACCOUNTANT', 'OWNER', 'SUPER_ADMIN'],
  TAX_COMPLIANCE: ['ACCOUNTANT', 'OWNER', 'SUPER_ADMIN'],
  STOCK_REORDER: ['WAREHOUSE_KEEPER', 'PURCHASING_MANAGER', 'OWNER', 'SUPER_ADMIN'],
  EXPIRING_BATCH: ['WAREHOUSE_KEEPER', 'OWNER', 'SUPER_ADMIN'],
  SALES_AUDIT: ['SALES_MANAGER', 'SALES_REP', 'OWNER', 'SUPER_ADMIN'],
  UNPOSTED_DRAFTS: ['ACCOUNTANT', 'WAREHOUSE_KEEPER'],
};

const FINANCIAL_CATEGORIES: ReadonlySet<NotificationCategory> = new Set([
  'FINANCIAL_LIQUIDITY',
  'PROFIT_ANOMALY',
  'TAX_COMPLIANCE',
]);

export function normalizeSentinelRole(role: string): SentinelRole | null {
  const lower = role.trim().toLowerCase();
  if (lower === 'owner' || lower === 'admin' || lower === 'super_admin' || lower === 'superadmin') {
    return lower === 'admin' || lower === 'owner' ? 'OWNER' : 'SUPER_ADMIN';
  }
  if (lower === 'financial_director' || lower === 'cfo') return 'FINANCIAL_DIRECTOR';
  if (lower === 'accountant') return 'ACCOUNTANT';
  if (
    lower === 'warehouse_keeper' ||
    lower === 'warehouse' ||
    lower === 'inventory_manager' ||
    lower === 'storekeeper'
  ) {
    return 'WAREHOUSE_KEEPER';
  }
  if (lower === 'purchasing_manager' || lower === 'purchasing' || lower === 'buyer') {
    return 'PURCHASING_MANAGER';
  }
  if (lower === 'sales_manager') return 'SALES_MANAGER';
  if (lower === 'sales_rep' || lower === 'sales' || lower === 'delegate') return 'SALES_REP';
  const upper = role.trim().toUpperCase();
  return (SENTINEL_ROLES as readonly string[]).includes(upper) ? (upper as SentinelRole) : null;
}

export function normalizeCallerRoles(roles: string[]): SentinelRole[] {
  const out = new Set<SentinelRole>();
  if (!Array.isArray(roles)) return [];
  for (const role of roles) {
    if (typeof role !== 'string') continue;
    const normalized = normalizeSentinelRole(role);
    if (normalized) out.add(normalized);
  }
  return [...out];
}

export function callerRank(roles: SentinelRole[]): number {
  return roles.reduce((max, role) => Math.max(max, ROLE_RANK[role] ?? 0), 0);
}

export function allowedCategoriesForRoles(roles: SentinelRole[]): NotificationCategory[] {
  const allowed: NotificationCategory[] = [];
  for (const [category, targets] of Object.entries(CATEGORY_TARGET_ROLES) as Array<
    [NotificationCategory, readonly SentinelRole[]]
  >) {
    if (targets.some((role) => roles.includes(role))) allowed.push(category);
  }
  return allowed;
}

export function asRoleList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

/**
 * A caller may only see a row when:
 * 1. The category is in the policy map for their verified roles.
 * 2. targetRoles intersects their roles (or the row is addressed to their userId).
 * 3. targetRoles does not exclusively contain higher-ranked roles than the caller.
 *    Mixed lists (e.g. stock + OWNER) are allowed if the caller is in the list.
 */
export function canReceiveNotification(input: {
  callerRoles: SentinelRole[];
  callerUserId: string;
  category: NotificationCategory;
  targetRoles: unknown;
  userId?: string | null;
}): boolean {
  const allowed = allowedCategoriesForRoles(input.callerRoles);
  if (!allowed.includes(input.category)) return false;

  if (input.userId && input.userId === input.callerUserId) return true;

  const targets = asRoleList(input.targetRoles)
    .map(normalizeSentinelRole)
    .filter((role): role is SentinelRole => Boolean(role));
  if (!targets.length) return false;
  if (!targets.some((role) => input.callerRoles.includes(role))) return false;

  if (FINANCIAL_CATEGORIES.has(input.category) && !input.callerRoles.some(isOwnerOrFinance)) {
    return false;
  }

  const maxTarget = targets.reduce((max, role) => Math.max(max, ROLE_RANK[role] ?? 0), 0);
  const rank = callerRank(input.callerRoles);
  const callerInList = targets.some((role) => input.callerRoles.includes(role));
  if (!callerInList && maxTarget > rank) return false;
  return true;
}

function isOwnerOrFinance(role: SentinelRole): boolean {
  return role === 'OWNER' || role === 'SUPER_ADMIN' || role === 'FINANCIAL_DIRECTOR';
}

export const FINANCIAL_TAB_CATEGORIES: NotificationCategory[] = [
  'FINANCIAL_LIQUIDITY',
  'PROFIT_ANOMALY',
  'CHEQUE_DUE',
  'TAX_COMPLIANCE',
  'SALES_AUDIT',
];

export const OPERATIONS_TAB_CATEGORIES: NotificationCategory[] = [
  'STOCK_REORDER',
  'EXPIRING_BATCH',
  'UNPOSTED_DRAFTS',
];
