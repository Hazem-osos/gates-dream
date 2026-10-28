/**
 * Platform-wide switches set from the admin panel.
 *
 * Read on hot paths (every tenant request, every AI call), so values are cached through the
 * shared tenant metadata cache (L1 + Redis, invalidated on write). A read failure — e.g. the
 * table not migrated yet — falls back to the defaults (everything on, no maintenance) so the
 * switches can never take production down by themselves.
 */
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { getTenantCached, invalidateTenantCache } from '../../../shared/cache/tenant-metadata-cache';

export interface PlatformSettings {
  aiEnabled: boolean;
  maintenance: { enabled: boolean; message: string };
}

const CACHE_KEY = 'platform:settings';
const DEFAULT_MAINTENANCE_MESSAGE = 'النظام في وضع الصيانة حالياً. يرجى المحاولة بعد قليل.';

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  aiEnabled: true,
  maintenance: { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE },
};

const KEY_AI = 'ai.enabled';
const KEY_MAINTENANCE = 'maintenance';

function fromRows(rows: Array<{ key: string; value: unknown }>): PlatformSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const ai = map.get(KEY_AI);
  const m = map.get(KEY_MAINTENANCE) as { enabled?: unknown; message?: unknown } | undefined;
  return {
    aiEnabled: typeof ai === 'boolean' ? ai : true,
    maintenance: {
      enabled: m?.enabled === true,
      message:
        typeof m?.message === 'string' && m.message.trim() ? m.message.trim() : DEFAULT_MAINTENANCE_MESSAGE,
    },
  };
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    return await getTenantCached(
      CACHE_KEY,
      async () => fromRows(await prisma.platformSetting.findMany({ select: { key: true, value: true } })),
      15,
      120
    );
  } catch (err) {
    logger.warn({ err }, '[PlatformSettings] read failed — using defaults');
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

export async function updatePlatformSettings(
  patch: { aiEnabled?: boolean; maintenance?: { enabled: boolean; message?: string } },
  updatedBy: string
): Promise<PlatformSettings> {
  const writes = [];
  if (typeof patch.aiEnabled === 'boolean') {
    writes.push(
      prisma.platformSetting.upsert({
        where: { key: KEY_AI },
        create: { key: KEY_AI, value: patch.aiEnabled, updatedBy },
        update: { value: patch.aiEnabled, updatedBy },
      })
    );
  }
  if (patch.maintenance) {
    const value = {
      enabled: patch.maintenance.enabled,
      message: patch.maintenance.message?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
    };
    writes.push(
      prisma.platformSetting.upsert({
        where: { key: KEY_MAINTENANCE },
        create: { key: KEY_MAINTENANCE, value, updatedBy },
        update: { value, updatedBy },
      })
    );
  }
  if (writes.length) await prisma.$transaction(writes);
  await invalidateTenantCache(CACHE_KEY);
  return fromRows(await prisma.platformSetting.findMany({ select: { key: true, value: true } }));
}
