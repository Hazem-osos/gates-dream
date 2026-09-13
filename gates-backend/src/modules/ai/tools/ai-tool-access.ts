import type { SecurityContext } from './types';

/** Returned to the LLM when a tool is requested without rights — never run the query. */
export const AI_TOOL_PERMISSION_DENIED_AR =
  'عذراً، هذا الحساب لا يملك الصلاحيات الكافية للوصول إلى هذه البيانات طبقاً لسياسات الأمان في النظام.';

export const OWNER_ROLES = ['OWNER', 'SUPER_ADMIN', 'owner', 'super_admin', 'admin', 'Admin'] as const;

export const FINANCIAL_DIRECTOR_ROLES = [
  ...OWNER_ROLES,
  'FINANCIAL_DIRECTOR',
  'financial_director',
  'accountant',
] as const;

/** OWNER / SUPER_ADMIN / FINANCIAL_DIRECTOR only — accountants are not aliased in. */
export const CFO_DECISION_ROLES = [
  'OWNER',
  'SUPER_ADMIN',
  'FINANCIAL_DIRECTOR',
  'owner',
  'super_admin',
  'superadmin',
  'admin',
  'Admin',
  'financial_director',
  'cfo',
] as const;

export type AiToolAccessMeta = {
  name: string;
  requiredPermission?: string;
  requiredPermissions?: string[];
  allowedRoles?: readonly string[];
  /** When true, `accountant` is not treated as FINANCIAL_DIRECTOR. */
  strictRoles?: boolean;
};

function normalizeRole(role: string, strict = false): string {
  const lower = role.trim().toLowerCase();
  if (lower === 'admin' || lower === 'owner' || lower === 'super_admin' || lower === 'superadmin') {
    return 'OWNER';
  }
  if (lower === 'financial_director' || lower === 'cfo') {
    return 'FINANCIAL_DIRECTOR';
  }
  if (!strict && lower === 'accountant') {
    return 'FINANCIAL_DIRECTOR';
  }
  return role.trim().toUpperCase();
}

export function extractJwtRoles(input: {
  role?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}): string[] {
  const roles = new Set<string>();
  for (const role of input.realm_access?.roles ?? []) {
    if (role) roles.add(role);
  }
  for (const role of input.resource_access?.['gates-backend']?.roles ?? []) {
    if (role) roles.add(role);
  }
  if (input.role) roles.add(input.role);
  return [...roles];
}

export function contextRoles(context: SecurityContext): string[] {
  if (context.roles?.length) return context.roles;
  if (context.role) return [context.role];
  return [];
}

export function hasAnyRole(
  context: SecurityContext,
  allowed: readonly string[],
  strict = false
): boolean {
  const user = contextRoles(context).map((role) => normalizeRole(role, strict));
  const needed = allowed.map((role) => normalizeRole(role, strict));
  return user.some((role) => needed.includes(role));
}

export function hasGrantedPermission(context: SecurityContext, required: string): boolean {
  const granted = context.permissions ?? [];
  if (!required) return true;
  if (granted.includes(required)) return true;
  if (granted.includes('*') || granted.includes('*:*')) return true;
  const [resource] = required.split(':');
  return Boolean(resource && granted.includes(`${resource}:*`));
}

export function permissionKeys(tool: AiToolAccessMeta): string[] {
  if (tool.requiredPermissions?.length) return tool.requiredPermissions.filter(Boolean);
  if (tool.requiredPermission) return [tool.requiredPermission];
  return [];
}

/**
 * Dynamic tool mask: role gate first, then any-of permissions.
 * `*` grants permissions but does not bypass an explicit allowedRoles list
 * unless the user also holds an allowed (or OWNER-equivalent) role.
 */
export function isAiToolAllowed(tool: AiToolAccessMeta, context: SecurityContext): boolean {
  if (tool.allowedRoles?.length && !hasAnyRole(context, tool.allowedRoles, Boolean(tool.strictRoles))) {
    return false;
  }
  const perms = permissionKeys(tool);
  if (perms.length === 0) return true;
  return perms.some((perm) => hasGrantedPermission(context, perm));
}

export function filterAiTools<T extends AiToolAccessMeta>(tools: T[], context: SecurityContext): T[] {
  return tools.filter((tool) => isAiToolAllowed(tool, context));
}
