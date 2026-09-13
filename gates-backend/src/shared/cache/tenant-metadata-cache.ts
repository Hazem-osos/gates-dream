/**
 * Two-tier tenant metadata cache: L1 in-process LRU (30–60s) + L2 Redis (~1h).
 * Invalidation publishes via Redis Pub/Sub so every app instance drops L1
 * and the publisher also purges matching L2 keys.
 */
import { LRUCache } from 'lru-cache';
import { redisClient } from './redis';
import { logger } from '../logger';
import { publishCacheInvalidation } from './cache-invalidation.bus';

export const L1_TTL_SEC = 45;
export const L2_TTL_SEC = 3600;

type L1Box = { v: unknown };

const l1 = new LRUCache<string, L1Box>({
  max: 8_192,
  ttl: L1_TTL_SEC * 1000,
});

function l1Get<T>(key: string): T | undefined {
  const box = l1.get(key);
  if (!box) return undefined;
  return box.v as T;
}

function l1Set(key: string, value: unknown, ttlSec: number): void {
  l1.set(key, { v: value }, { ttl: ttlSec * 1000 });
}

export function clearLocalCacheByPrefix(prefix: string): void {
  for (const k of l1.keys()) {
    if (k === prefix || k.startsWith(prefix)) l1.delete(k);
  }
}

export function clearEntireL1(): void {
  l1.clear();
}

let l1FlushBound = false;

/** Flush every tenant's L1 when Redis becomes ready after a partition. */
export function bindL1FlushOnRedisReady(): void {
  if (l1FlushBound) return;
  l1FlushBound = true;
  redisClient.onReady(() => {
    l1.clear();
    logger.warn('Flushed L1 tenant cache after Redis ready');
  });
}

bindL1FlushOnRedisReady();

async function deleteRedisByPrefix(prefix: string): Promise<void> {
  if (!redisClient.isReady()) return;
  try {
    const keys = await redisClient.getClient().keys(`${prefix}*`);
    if (keys.length) await redisClient.getClient().del(...keys);
  } catch (err) {
    logger.warn({ err, prefix }, 'Redis L2 invalidate failed');
  }
}

export async function getTenantCached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSec = L1_TTL_SEC,
  l2TtlSec = L2_TTL_SEC
): Promise<T> {
  const hit = l1Get<T>(key);
  if (hit !== undefined) return hit;

  if (redisClient.isReady()) {
    try {
      const raw = await redisClient.getClient().get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        l1Set(key, parsed, ttlSec);
        return parsed;
      }
    } catch (err) {
      logger.warn({ err, key }, 'Redis L2 cache read failed');
    }
  }

  const value = await loader();
  l1Set(key, value, ttlSec);

  if (redisClient.isReady()) {
    try {
      await redisClient.getClient().setex(key, l2TtlSec, JSON.stringify(value));
    } catch (err) {
      logger.warn({ err, key }, 'Redis L2 cache write failed');
    }
  }

  return value;
}

export async function invalidateTenantCache(prefix: string): Promise<void> {
  clearLocalCacheByPrefix(prefix);
  await deleteRedisByPrefix(prefix);
  const published = await publishCacheInvalidation(prefix);
  if (!published) {
    clearEntireL1();
    logger.error({ prefix }, 'Invalidation did not reach Redis; flushed entire L1');
  }
}

export const tenantCacheKeys = {
  subscription: (companyId: string) => `tenant:sub:${companyId}`,
  branches: (companyId: string) => `tenant:branches:${companyId}`,
  settings: (companyId: string) => `tenant:settings:${companyId}`,
  settingEntry: (companyId: string, name: string, branchId?: string | null) =>
    `tenant:settings:${companyId}:${name}:${branchId ?? '_'}`,
  companySettings: (companyId: string) => `tenant:company-settings:${companyId}`,
  coaTree: (companyId: string) => `tenant:coa-tree:${companyId}`,
  taxPeriods: (companyId: string, fiscalYearId?: string) =>
    `tenant:tax-periods:${companyId}:${fiscalYearId ?? 'all'}`,
  taxRates: (companyId: string) => `tenant:tax-rates:${companyId}`,
  userPerms: (companyId: string, userId: string) => `tenant:perms:${companyId}:${userId}`,
};
