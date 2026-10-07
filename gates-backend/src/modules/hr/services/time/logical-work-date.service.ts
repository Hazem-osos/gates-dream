import { toDateOnly } from '../../utils/hr-effective-date.util';
import { scheduleResolutionService } from './schedule-resolution.service';
import { instantFromLocal, localDateKey, parseDateOnly } from './time-zone.util';
import type { HcmWorkShift } from '@prisma/client';

const DEFAULT_PADDING_MINUTES = 6 * 60;

function dateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function previousDateKey(key: string): string {
  const { year, month, day } = parseDateOnly(key);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function localInstantOnLogicalDay(
  logicalWorkDate: Date,
  minutesFromMidnight: number,
  timezone: string,
  dayOffset = 0
): Date {
  const { year, month, day } = parseDateOnly(toDateOnly(logicalWorkDate).toISOString().slice(0, 10));
  const base = new Date(Date.UTC(year, month - 1, day));
  if (dayOffset) base.setUTCDate(base.getUTCDate() + dayOffset);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const d = base.getUTCDate();
  const h = Math.floor(minutesFromMidnight / 60);
  const min = minutesFromMidnight % 60;
  return instantFromLocal(y, m, d, h, min, timezone);
}

/** Inclusive punch-matching window for a logical work day + shift. */
export function punchMatchingWindow(
  shift: HcmWorkShift,
  logicalWorkDate: Date,
  timezone: string
): { windowStart: Date; windowEnd: Date } {
  const bounds = scheduleResolutionService.shiftBounds(shift, logicalWorkDate, timezone);
  let windowStart = new Date(bounds.scheduledStartAt.getTime() - DEFAULT_PADDING_MINUTES * 60_000);
  let windowEnd = new Date(bounds.scheduledEndAt.getTime() + DEFAULT_PADDING_MINUTES * 60_000);

  if (shift.inWindowStartMinutes != null) {
    const customStart = localInstantOnLogicalDay(logicalWorkDate, shift.inWindowStartMinutes, timezone);
    if (customStart.getTime() < windowStart.getTime()) windowStart = customStart;
  }
  if (shift.inWindowEndMinutes != null) {
    const crosses =
      shift.inWindowEndMinutes < (shift.inWindowStartMinutes ?? shift.inWindowEndMinutes);
    const customInEnd = localInstantOnLogicalDay(
      logicalWorkDate,
      shift.inWindowEndMinutes,
      timezone,
      crosses ? 1 : 0
    );
    if (customInEnd.getTime() > windowStart.getTime() && customInEnd.getTime() < bounds.scheduledStartAt.getTime()) {
      windowStart = customStartEarlier(windowStart, customInEnd);
    }
  }
  if (shift.outWindowEndMinutes != null) {
    const crosses =
      shift.crossesMidnight ||
      shift.outWindowEndMinutes <= (shift.outWindowStartMinutes ?? shift.outWindowEndMinutes);
    const customEnd = localInstantOnLogicalDay(
      logicalWorkDate,
      shift.outWindowEndMinutes,
      timezone,
      crosses ? 1 : 0
    );
    if (customEnd.getTime() > windowEnd.getTime()) windowEnd = customEnd;
  }

  return { windowStart, windowEnd };
}

function customStartEarlier(a: Date, b: Date): Date {
  return a.getTime() < b.getTime() ? a : b;
}

/**
 * Resolve which logical attendance day owns a punch (overnight-safe).
 */
export async function resolveLogicalWorkDateForPunch(
  companyId: string,
  employmentId: string,
  punchedAt: Date,
  timezone: string
): Promise<Date> {
  const punchKey = localDateKey(punchedAt, timezone);
  const candidateKeys = [punchKey, previousDateKey(punchKey)];

  let best: { logical: Date; distance: number } | null = null;

  for (const key of candidateKeys) {
    const logical = dateFromKey(key);
    const resolved = await scheduleResolutionService.resolve(companyId, employmentId, logical, timezone);
    if (!resolved.shift) continue;
    const { windowStart, windowEnd } = punchMatchingWindow(resolved.shift, logical, timezone);
    const t = punchedAt.getTime();
    if (t >= windowStart.getTime() && t <= windowEnd.getTime()) {
      const distance = Math.abs(t - scheduleResolutionService.shiftBounds(resolved.shift, logical, timezone).scheduledStartAt.getTime());
      if (!best || distance < best.distance) {
        best = { logical, distance };
      }
    }
  }

  if (best) return best.logical;
  return dateFromKey(punchKey);
}

export const logicalWorkDateService = {
  resolveLogicalWorkDateForPunch,
  punchMatchingWindow,
};
