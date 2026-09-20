import { createHash, timingSafeEqual } from 'node:crypto';

export const INTERNAL_AUTOMATION_PERMISSION = 'automation:internal';

export type InternalAutomationAuth = {
  source: 'platform-secret' | 'api-key';
  apiKey?: { tenantId?: string; permissions: string[] };
  scopedCompanyId?: string;
};

function hashesEqual(left: string, right: string): boolean {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b);
}

export function matchesPlatformAutomationSecret(
  presented: string,
  configured: string | undefined
): boolean {
  if (!configured?.trim()) return false;
  return hashesEqual(presented, configured.trim());
}

export function apiKeyMayLookupCompany(
  requestedCompanyId: string,
  apiKey: { tenantId?: string; permissions: string[] }
): boolean {
  const scoped = apiKey.tenantId?.trim();
  if (scoped) {
    return scoped === requestedCompanyId;
  }
  const permissions = apiKey.permissions ?? [];
  return permissions.includes('*') || permissions.includes(INTERNAL_AUTOMATION_PERMISSION);
}

export function resolveInternalCompanyAccess(
  requestedCompanyId: string,
  auth: InternalAutomationAuth | undefined
): 'allow' | 'unauthenticated' | 'forbidden' {
  if (!auth) return 'unauthenticated';
  if (auth.source === 'platform-secret') return 'allow';
  if (auth.apiKey && apiKeyMayLookupCompany(requestedCompanyId, auth.apiKey)) return 'allow';
  return 'forbidden';
}
