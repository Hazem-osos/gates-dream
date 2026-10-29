/**
 * Platform announcements shown as a bar inside the ERP.
 * The tenant read path is hot (every page load), so active announcements are cached briefly
 * and filtered per company in memory.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { getTenantCached, invalidateTenantCache } from '../../../shared/cache/tenant-metadata-cache';

const ACTIVE_KEY = 'platform:announcements:active';

export const ANNOUNCEMENT_LEVELS = ['info', 'warning', 'critical'] as const;
export const ANNOUNCEMENT_AUDIENCES = ['ALL', 'COMPANIES'] as const;

export interface AnnouncementInput {
  title: string;
  body: string;
  level: (typeof ANNOUNCEMENT_LEVELS)[number];
  audience: (typeof ANNOUNCEMENT_AUDIENCES)[number];
  companyIds?: string[];
  startsAt?: Date;
  endsAt?: Date | null;
  isActive?: boolean;
}

function normalize(input: AnnouncementInput) {
  if (input.audience === 'COMPANIES' && !input.companyIds?.length) {
    throw new AppError(422, 'اختر شركة واحدة على الأقل أو اجعل الإعلان لكل الشركات');
  }
  if (input.endsAt && input.startsAt && input.endsAt <= input.startsAt) {
    throw new AppError(422, 'وقت الانتهاء يجب أن يكون بعد وقت البداية');
  }
  return {
    title: input.title.trim(),
    body: input.body.trim(),
    level: input.level,
    audience: input.audience,
    companyIds: (input.audience === 'COMPANIES' ? input.companyIds ?? [] : null) as Prisma.InputJsonValue | null,
    ...(input.startsAt ? { startsAt: input.startsAt } : {}),
    endsAt: input.endsAt ?? null,
    ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
  };
}

export async function listAnnouncements() {
  return prisma.platformAnnouncement.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
}

export async function createAnnouncement(input: AnnouncementInput, createdBy: string) {
  const data = normalize(input);
  const row = await prisma.platformAnnouncement.create({
    data: { ...data, companyIds: data.companyIds ?? undefined, createdBy },
  });
  await invalidateTenantCache(ACTIVE_KEY);
  return row;
}

export async function updateAnnouncement(id: string, input: AnnouncementInput) {
  const exists = await prisma.platformAnnouncement.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, 'الإعلان غير موجود');
  const data = normalize(input);
  const row = await prisma.platformAnnouncement.update({
    where: { id },
    data: { ...data, companyIds: data.companyIds ?? Prisma.DbNull },
  });
  await invalidateTenantCache(ACTIVE_KEY);
  return row;
}

export async function setAnnouncementActive(id: string, isActive: boolean) {
  const exists = await prisma.platformAnnouncement.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, 'الإعلان غير موجود');
  const row = await prisma.platformAnnouncement.update({ where: { id }, data: { isActive } });
  await invalidateTenantCache(ACTIVE_KEY);
  return row;
}

export async function deleteAnnouncement(id: string) {
  await prisma.platformAnnouncement.deleteMany({ where: { id } });
  await invalidateTenantCache(ACTIVE_KEY);
}

interface CachedAnnouncement {
  id: string;
  title: string;
  body: string;
  level: string;
  audience: string;
  companyIds: string[] | null;
  startsAt: string | Date;
  endsAt: string | Date | null;
}

/** What one company's users should see now. Never throws: a failure shows no announcements. */
export async function activeAnnouncementsFor(companyId: string) {
  try {
    const all = await getTenantCached<CachedAnnouncement[]>(
      ACTIVE_KEY,
      async () => {
        const rows = await prisma.platformAnnouncement.findMany({
          where: { isActive: true },
          orderBy: { startsAt: 'desc' },
          take: 50,
          select: { id: true, title: true, body: true, level: true, audience: true, companyIds: true, startsAt: true, endsAt: true },
        });
        return rows.map((r) => ({
          ...r,
          companyIds: Array.isArray(r.companyIds) ? (r.companyIds as string[]) : null,
        }));
      },
      30,
      60
    );
    const now = Date.now();
    return all
      .filter((a) => new Date(a.startsAt).getTime() <= now && (!a.endsAt || new Date(a.endsAt).getTime() > now))
      .filter((a) => a.audience === 'ALL' || (a.companyIds ?? []).includes(companyId))
      .map(({ id, title, body, level }) => ({ id, title, body, level }));
  } catch (err) {
    logger.warn({ err }, '[Announcements] read failed — showing none');
    return [];
  }
}
