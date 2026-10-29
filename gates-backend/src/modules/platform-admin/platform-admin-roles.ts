/**
 * What each platform admin role may do. Routes check one capability each (requireCap).
 * The frontend receives the caps from /auth/me to hide what the admin cannot use.
 */
export const PLATFORM_ADMIN_ROLES = ['OWNER', 'SUPPORT', 'FINANCE', 'SALES', 'VIEWER'] as const;
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export const PLATFORM_CAPS = [
  'dashboard.view',
  'companies.view',
  'companies.create',
  'companies.edit',
  'companies.disable',
  'licenses.edit',
  'ai.edit',
  'users.view',
  'users.edit',
  'users.credentials',
  'users.delete',
  'announcements.manage',
  'settings.edit',
  'admins.manage',
  'audit.view',
  'security.view',
] as const;
export type PlatformCap = (typeof PLATFORM_CAPS)[number];

const ROLE_CAPS: Record<PlatformAdminRole, readonly PlatformCap[]> = {
  OWNER: PLATFORM_CAPS,
  SUPPORT: [
    'dashboard.view',
    'companies.view',
    'users.view',
    'users.edit',
    'users.credentials',
    'announcements.manage',
    'audit.view',
    'security.view',
  ],
  FINANCE: ['dashboard.view', 'companies.view', 'licenses.edit', 'ai.edit', 'audit.view'],
  SALES: ['dashboard.view', 'companies.view', 'companies.create', 'users.view'],
  VIEWER: ['dashboard.view', 'companies.view', 'users.view', 'audit.view'],
};

export function isPlatformAdminRole(value: unknown): value is PlatformAdminRole {
  return typeof value === 'string' && (PLATFORM_ADMIN_ROLES as readonly string[]).includes(value);
}

/** Unknown roles get nothing (fail closed). */
export function capsForRole(role: string): PlatformCap[] {
  return isPlatformAdminRole(role) ? [...ROLE_CAPS[role]] : [];
}

export function roleHasCap(role: string, cap: PlatformCap): boolean {
  return capsForRole(role).includes(cap);
}
