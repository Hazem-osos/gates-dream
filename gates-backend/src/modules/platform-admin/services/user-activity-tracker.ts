/**
 * "How much does this user actually work?" — per user, per day: request count and the number of
 * distinct minutes with activity.
 *
 * Authenticated requests only touch an in-memory buffer; a timer flushes it once a minute with
 * one upsert per user-day, so the request path never waits on the database. Counts are an
 * approximation: a crash loses at most the last minute, and two backend replicas may each count
 * the same minute.
 */
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { redisClient } from '../../../shared/cache/redis';

const FLUSH_INTERVAL_MS = 60_000;
const MINUTE_KEY_TTL_SEC = 2 * 24 * 60 * 60;
const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

interface PendingDay {
  userId: string;
  companyId: string;
  day: string;
  requests: number;
  minutes: Set<number>;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

let pending = new Map<string, PendingDay>();
/** Minutes already counted per user-day, so a minute is never added twice by this process. */
const countedMinutes = new Map<string, Set<number>>();
let timer: NodeJS.Timeout | null = null;
let flushing = false;

/** Business day in Egypt time, as YYYY-MM-DD. */
export function activityDayKey(now: Date): string {
  return DAY_FORMAT.format(now);
}

export function activityDayDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function ensureTimer(): void {
  if (timer) return;
  timer = setInterval(() => {
    void flushUserActivity();
  }, FLUSH_INTERVAL_MS);
  timer.unref?.();
}

export function trackUserActivity(userId: string, companyId: string, now: Date = new Date()): void {
  if (process.env.NODE_ENV === 'test' || !userId || !companyId) return;
  const day = activityDayKey(now);
  const key = `${userId}|${day}`;
  let entry = pending.get(key);
  if (!entry) {
    entry = { userId, companyId, day, requests: 0, minutes: new Set(), firstSeenAt: now, lastSeenAt: now };
    pending.set(key, entry);
  }
  entry.requests += 1;
  entry.minutes.add(Math.floor(now.getTime() / 60_000));
  entry.lastSeenAt = now;
  ensureTimer();
}

/**
 * The API runs one process per CPU core, and each one buffers its own requests. A minute counts
 * once platform-wide: the first process to `SET NX` the user+minute key in Redis owns it.
 * Without Redis (local dev), this process's own memory is the only dedupe.
 */
async function claimMinutes(userId: string, minutes: number[]): Promise<number> {
  if (minutes.length === 0) return 0;
  if (!redisClient.isReady()) return minutes.length;
  try {
    const pipeline = redisClient.getClient().pipeline();
    for (const m of minutes) pipeline.set(`activity:min:${userId}:${m}`, '1', 'EX', MINUTE_KEY_TTL_SEC, 'NX');
    const results = (await pipeline.exec()) ?? [];
    return results.filter(([err, reply]) => !err && reply === 'OK').length;
  } catch (err) {
    logger.debug({ err }, '[UserActivity] redis minute claim failed — counting locally');
    return minutes.length;
  }
}

export async function flushUserActivity(): Promise<void> {
  if (flushing || pending.size === 0) return;
  flushing = true;
  const batch = pending;
  pending = new Map();
  const today = activityDayKey(new Date());
  try {
    for (const [key, entry] of batch) {
      let seen = countedMinutes.get(key);
      if (!seen) {
        seen = new Set();
        countedMinutes.set(key, seen);
      }
      const candidates: number[] = [];
      for (const m of entry.minutes) {
        if (!seen.has(m)) {
          seen.add(m);
          candidates.push(m);
        }
      }
      const newMinutes = await claimMinutes(entry.userId, candidates);
      const day = activityDayDate(entry.day);
      const update = {
        requestCount: { increment: entry.requests },
        activeMinutes: { increment: newMinutes },
        lastSeenAt: entry.lastSeenAt,
      };
      try {
        await prisma.userActivityDay.upsert({
          where: { userId_day: { userId: entry.userId, day } },
          create: {
            userId: entry.userId,
            companyId: entry.companyId,
            day,
            requestCount: entry.requests,
            activeMinutes: newMinutes,
            firstSeenAt: entry.firstSeenAt,
            lastSeenAt: entry.lastSeenAt,
          },
          update,
        });
      } catch (err) {
        // Another replica created the row first → retry as a plain update; deleted user → drop.
        try {
          await prisma.userActivityDay.update({
            where: { userId_day: { userId: entry.userId, day } },
            data: update,
          });
        } catch {
          logger.debug({ err, userId: entry.userId }, '[UserActivity] dropped one activity bucket');
        }
      }
    }
    for (const key of countedMinutes.keys()) {
      if (!key.endsWith(`|${today}`)) countedMinutes.delete(key);
    }
  } catch (err) {
    logger.warn({ err }, '[UserActivity] flush failed');
  } finally {
    flushing = false;
  }
}
