import { LRUCache } from 'lru-cache';
import prisma from '../database/prisma';
import type { Permission } from '../auth/types';
import { fiscalYearService } from '../../modules/platform/services/fiscal-year.service';
import {
  getTenantCached,
  invalidateTenantCache,
  tenantCacheKeys,
} from './tenant-metadata-cache';

const TTL_MS = 5 * 60 * 1000;

export type CachedCompanyRow = { id: string; isActive: boolean };

export type CachedPermissionRow = {
  resource: string;
  action: Permission['action'];
  module: string | null;
  branchId: string | null;
  allow: boolean;
};

export type CachedUserPermissions = {
  grantAll: boolean;
  permissions: CachedPermissionRow[];
};

const companyCache = new LRUCache<string, CachedCompanyRow>({ max: 512, ttl: TTL_MS });
const permissionCache = new LRUCache<string, CachedUserPermissions>({ max: 4096, ttl: TTL_MS });
const defaultFiscalYearCache = new LRUCache<string, { fiscalYearId: string | null }>({
  max: 512,
  ttl: TTL_MS,
});

function permKey(companyId: string, userId: string): string {
  return `${companyId}:${userId}`;
}

export function invalidateTenantCompanyCache(companyId: string): void {
  companyCache.delete(companyId);
  defaultFiscalYearCache.delete(companyId);
}

export function invalidateUserPermissionCache(userId: string, companyId: string): void {
  permissionCache.delete(permKey(companyId, userId));
  void invalidateTenantCache(tenantCacheKeys.userPerms(companyId, userId));
}

export function invalidateAllPermissionsForCompany(companyId: string): void {
  for (const key of permissionCache.keys()) {
    if (key.startsWith(`${companyId}:`)) permissionCache.delete(key);
  }
  void invalidateTenantCache(`tenant:perms:${companyId}:`);
}

export async function getCachedActiveCompany(companyId: string): Promise<CachedCompanyRow | null> {
  const hit = companyCache.get(companyId);
  if (hit) return hit;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, isActive: true },
  });
  if (!company) return null;

  const row: CachedCompanyRow = { id: company.id, isActive: company.isActive };
  companyCache.set(companyId, row);
  return row;
}

export async function getCachedDefaultFiscalYearId(companyId: string): Promise<string | null> {
  const hit = defaultFiscalYearCache.get(companyId);
  if (hit !== undefined) return hit.fiscalYearId;

  const id = await fiscalYearService.resolveDefaultFiscalYearId(companyId);
  defaultFiscalYearCache.set(companyId, { fiscalYearId: id });
  return id;
}

export async function getCachedUserPermissions(
  userId: string,
  companyId: string
): Promise<CachedUserPermissions> {
  return getTenantCached(tenantCacheKeys.userPerms(companyId, userId), async () => {
    const [grantAllRow, permissions] = await Promise.all([
      prisma.userPermission.findFirst({
        where: { userId, companyId, resource: '*', allow: true },
        select: { id: true },
      }),
      prisma.userPermission.findMany({
        where: { userId, companyId, allow: true },
        select: {
          resource: true,
          action: true,
          module: true,
          branchId: true,
          allow: true,
        },
      }),
    ]);

    return {
      grantAll: Boolean(grantAllRow),
      permissions: permissions as CachedPermissionRow[],
    };
  });
}

export function permissionGrantedFromCache(
  snap: CachedUserPermissions,
  requiredResource: string,
  requiredAction: Permission['action'],
  options?: { module?: string; branchId?: string }
): boolean {
  if (snap.grantAll) return true;

  const resourceOk = (resource: string) =>
    resource === requiredResource || resource === '*';

  const matchesScoped = (row: CachedPermissionRow): boolean => {
    if (!row.allow || !resourceOk(row.resource) || row.action !== requiredAction) {
      return false;
    }
    if (options?.module && row.module !== options.module) return false;
    if (options?.branchId && row.branchId !== options.branchId) return false;
    return true;
  };

  for (const row of snap.permissions) {
    if (matchesScoped(row)) return true;
  }

  if (options?.module || options?.branchId) {
    for (const row of snap.permissions) {
      if (row.module != null || row.branchId != null) continue;
      if (!row.allow || !resourceOk(row.resource) || row.action !== requiredAction) continue;
      return true;
    }
  }

  return false;
}
