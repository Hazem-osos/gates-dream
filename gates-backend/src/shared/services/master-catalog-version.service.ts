import { createHash } from 'node:crypto';
import prisma from '../database/prisma';
import { redisClient } from '../cache/redis';
import { tenantCacheKeys } from '../cache/tenant-metadata-cache';
import { buildWeakEtag } from '../http/master-data-etag';

/** SHA-1 prefix of a Redis-cached dataset, or null when Redis is cold/down. */
export async function peekRedisPayloadHash(redisKey: string): Promise<string | null> {
  if (!redisClient.isReady()) return null;
  try {
    const raw = await redisClient.getClient().get(redisKey);
    if (!raw) return null;
    return createHash('sha1').update(raw).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

/** Prefer the Redis payload hash; otherwise stamp from updated-at / query parts. */
export async function etagFromRedisHashOrStamp(
  redisKey: string,
  stampParts: (string | number | Date | null | undefined)[]
): Promise<string> {
  const redisHash = await peekRedisPayloadHash(redisKey);
  if (redisHash) {
    return buildWeakEtag(['redis', redisKey, redisHash, ...stampParts]);
  }
  return buildWeakEtag(stampParts);
}

export type MasterCatalogEntity = 'item' | 'customer' | 'account';

export async function getMasterCatalogEtag(
  companyId: string,
  entity: MasterCatalogEntity
): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { updatedAt: true },
  });

  let maxUpdated: Date | null = null;
  if (entity === 'item') {
    const agg = await prisma.item.aggregate({
      where: { companyId },
      _max: { updatedAt: true },
    });
    maxUpdated = agg._max?.updatedAt ?? null;
  } else if (entity === 'customer') {
    const agg = await prisma.customer.aggregate({
      where: { companyId, deletedAt: null },
      _max: { updatedAt: true },
    });
    maxUpdated = agg._max?.updatedAt ?? null;
  } else {
    const agg = await prisma.account.aggregate({
      where: { companyId, deletedAt: null },
      _max: { updatedAt: true },
    });
    maxUpdated = agg._max?.updatedAt ?? null;
  }

  return buildWeakEtag([companyId, entity, company?.updatedAt, maxUpdated]);
}

export async function getCompanySettingsEtag(companyId: string): Promise<string> {
  const [company, settings] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { updatedAt: true } }),
    prisma.companySettings.findUnique({
      where: { companyId },
      select: { updatedAt: true },
    }),
  ]);
  return buildWeakEtag([companyId, 'settings', company?.updatedAt, settings?.updatedAt]);
}

export async function getCoaTreeEtag(
  companyId: string,
  parentId?: string | null
): Promise<string> {
  const [company, agg] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { updatedAt: true } }),
    prisma.account.aggregate({
      where: { companyId, deletedAt: null },
      _max: { updatedAt: true },
      _count: { _all: true },
    }),
  ]);
  return etagFromRedisHashOrStamp(tenantCacheKeys.coaTree(companyId), [
    companyId,
    'coa-tree',
    parentId ?? 'root',
    company?.updatedAt,
    agg._max?.updatedAt,
    agg._count._all,
  ]);
}

export async function getBranchesEtag(
  companyId: string,
  query?: { page?: number; limit?: number; search?: string }
): Promise<string> {
  const page = query?.page || 1;
  const limit = query?.limit || 50;
  const [company, agg] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { updatedAt: true } }),
    prisma.branch.aggregate({
      where: { companyId, deletedAt: null },
      _max: { updatedAt: true },
    }),
  ]);
  const redisKey = `${tenantCacheKeys.branches(companyId)}:p${page}:l${limit}`;
  return etagFromRedisHashOrStamp(redisKey, [
    companyId,
    'branches',
    company?.updatedAt,
    agg._max?.updatedAt,
    page,
    limit,
    query?.search,
  ]);
}

export async function getTaxPeriodsEtag(
  companyId: string,
  fiscalYearId?: string
): Promise<string> {
  const agg = await prisma.taxPeriod.aggregate({
    where: {
      companyId,
      ...(fiscalYearId ? { fiscalYearId } : {}),
    },
    _max: { updatedAt: true },
  });
  return etagFromRedisHashOrStamp(tenantCacheKeys.taxPeriods(companyId, fiscalYearId), [
    companyId,
    'tax-periods',
    fiscalYearId ?? 'all',
    agg._max?.updatedAt,
  ]);
}

