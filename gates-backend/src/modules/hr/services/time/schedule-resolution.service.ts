import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { instantFromLocal, localDateParts, parseDateOnly } from './time-zone.util';
import { resolveRotationShiftId } from './schedule-rotation.util';
import type { HcmWorkShift, HcmWorkSchedule } from '@prisma/client';

export type ResolvedSchedule = {
  schedule: HcmWorkSchedule | null;
  shift: HcmWorkShift | null;
  timezone: string;
  dayClassification:
    | 'SCHEDULED_WORK'
    | 'REST_DAY'
    | 'HOLIDAY'
    | 'NO_SCHEDULE'
    | 'PUBLIC_HOLIDAY'
    | 'COMPANY_HOLIDAY';
};

type WeeklyPattern = { weekly?: Record<string, string | null>; rotation?: { anchorDate: string; cycleDays: Array<string | null> } };

/**
 * Precedence:
 * 1) WORKING_OVERRIDE (forces work; uses weekly/rotation shift unless override carries shiftId)
 * 2) Calendar REST_DAY
 * 3) PUBLIC/COMPANY holiday
 * 4) Employee schedule assignment (effective-dated) → DEFAULT schedule
 * 5) Weekly or rotation pattern
 */
export class ScheduleResolutionService {
  async resolve(
    companyId: string,
    employmentId: string,
    logicalWorkDate: Date,
    timezone = 'UTC'
  ): Promise<ResolvedSchedule> {
    const day = toDateOnly(logicalWorkDate);
    const { year, month, day: dom } = parseDateOnly(day.toISOString().slice(0, 10));
    const dow = localDateParts(
      new Date(Date.UTC(year, month - 1, dom, 12, 0, 0)),
      timezone
    ).dayOfWeek;

    const calendarRows = await prisma.hcmCalendarDay.findMany({
      where: { companyId, calendarDate: day },
    });
    const overrideWork = calendarRows.find((r) => r.dayType === 'WORKING_OVERRIDE');
    const restDay = calendarRows.find((r) => r.dayType === 'REST_DAY');
    const publicHoliday = calendarRows.find((r) => r.dayType === 'PUBLIC_HOLIDAY');
    const companyHoliday = calendarRows.find((r) => r.dayType === 'COMPANY_HOLIDAY');

    if (restDay && !overrideWork) {
      return { schedule: null, shift: null, timezone, dayClassification: 'REST_DAY' };
    }

    const assignment = await prisma.hcmEmployeeScheduleAssignment.findFirst({
      where: {
        companyId,
        employmentId,
        effectiveFrom: { lte: day },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      include: { schedule: true },
    });

    let schedule = assignment?.schedule ?? null;
    if (!schedule) {
      schedule = await prisma.hcmWorkSchedule.findFirst({
        where: { companyId, code: 'DEFAULT', isActive: true },
      });
    }

    if (!schedule && !overrideWork) {
      if (publicHoliday) {
        return { schedule: null, shift: null, timezone, dayClassification: 'PUBLIC_HOLIDAY' };
      }
      if (companyHoliday) {
        return { schedule: null, shift: null, timezone, dayClassification: 'COMPANY_HOLIDAY' };
      }
      if (restDay) {
        return { schedule, shift: null, timezone, dayClassification: 'REST_DAY' };
      }
      return { schedule: null, shift: null, timezone, dayClassification: 'NO_SCHEDULE' };
    }

    const pattern = (schedule?.pattern ?? { weekly: {} }) as WeeklyPattern;
    let shiftId: string | null = null;

    if (!shiftId && schedule?.scheduleType === 'ROTATION') {
      shiftId = resolveRotationShiftId(pattern, day);
    }
    if (!shiftId) {
      shiftId = pattern.weekly?.[String(dow)] ?? pattern.weekly?.[dow] ?? null;
    }

    if (!shiftId && !overrideWork) {
      if (publicHoliday) {
        return { schedule, shift: null, timezone, dayClassification: 'PUBLIC_HOLIDAY' };
      }
      if (companyHoliday) {
        return { schedule, shift: null, timezone, dayClassification: 'COMPANY_HOLIDAY' };
      }
      if (restDay) {
        return { schedule, shift: null, timezone, dayClassification: 'REST_DAY' };
      }
      return { schedule, shift: null, timezone, dayClassification: 'REST_DAY' };
    }

    const shift = shiftId
      ? await prisma.hcmWorkShift.findFirst({ where: { id: shiftId, companyId, isActive: true } })
      : null;
    if (!shift && !overrideWork) {
      return { schedule, shift: null, timezone, dayClassification: 'REST_DAY' };
    }

    if (publicHoliday && !overrideWork) {
      return { schedule, shift, timezone, dayClassification: 'PUBLIC_HOLIDAY' };
    }
    if (companyHoliday && !overrideWork) {
      return { schedule, shift, timezone, dayClassification: 'COMPANY_HOLIDAY' };
    }

    return { schedule, shift, timezone, dayClassification: 'SCHEDULED_WORK' };
  }

  shiftBounds(
    shift: HcmWorkShift,
    logicalWorkDate: Date,
    timezone: string
  ): { scheduledStartAt: Date; scheduledEndAt: Date; scheduledMinutes: number } {
    const { year, month, day } = parseDateOnly(toDateOnly(logicalWorkDate).toISOString().slice(0, 10));
    const startH = Math.floor(shift.startTimeMinutes / 60);
    const startM = shift.startTimeMinutes % 60;
    const endH = Math.floor(shift.endTimeMinutes / 60);
    const endM = shift.endTimeMinutes % 60;
    const scheduledStartAt = instantFromLocal(year, month, day, startH, startM, timezone);
    let endDay = day;
    let endMonth = month;
    let endYear = year;
    if (shift.crossesMidnight || shift.endTimeMinutes <= shift.startTimeMinutes) {
      const next = new Date(Date.UTC(year, month - 1, day));
      next.setUTCDate(next.getUTCDate() + 1);
      endYear = next.getUTCFullYear();
      endMonth = next.getUTCMonth() + 1;
      endDay = next.getUTCDate();
    }
    const scheduledEndAt = instantFromLocal(endYear, endMonth, endDay, endH, endM, timezone);
    const scheduledMinutes =
      shift.expectedWorkMinutes ??
      Math.max(
        0,
        Math.round((scheduledEndAt.getTime() - scheduledStartAt.getTime()) / 60_000) -
          shift.unpaidBreakMinutes
      );
    return { scheduledStartAt, scheduledEndAt, scheduledMinutes };
  }
}

export const scheduleResolutionService = new ScheduleResolutionService();
