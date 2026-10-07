import { createHash } from 'crypto';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { scheduleResolutionService } from './schedule-resolution.service';
import { matchPunches } from './punch-matching.service';
import {
  computeEarlyLeaveMinutes,
  computeLateMinutes,
  DEFAULT_POLICY_RULES,
  type AttendancePolicyRules,
} from './time-policy.domain';
import { clampMinutes, diffMinutesUtc, roundMinutes } from './time-minutes.util';
import { interpretClockInstant } from './clock-rounding.util';
import { punchMatchingWindow } from './logical-work-date.service';
import { leaveTimeOverlayService } from '../leave/leave-time-overlay.service';

export class AttendanceCalculationService {
  async getActivePolicyRow(companyId: string, day: Date) {
    return prisma.hcmAttendancePolicy.findFirst({
      where: {
        companyId,
        isActive: true,
        effectiveFrom: { lte: day },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async getActivePolicy(companyId: string, day: Date): Promise<AttendancePolicyRules> {
    const row = await this.getActivePolicyRow(companyId, day);
    return (row?.rules as AttendancePolicyRules) ?? DEFAULT_POLICY_RULES;
  }

  async recalculateDay(
    companyId: string,
    employmentId: string,
    logicalWorkDate: Date,
    timezone = 'UTC'
  ) {
    const logical = toDateOnly(logicalWorkDate);
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: employmentId, companyId },
      include: { employee: true },
    });
    if (!employment) throw new AppError(404, 'Employment not found');

    if (employment.hireDate && logical.getTime() < toDateOnly(employment.hireDate).getTime()) {
      throw new AppError(422, 'Before employment hire date');
    }
    if (employment.terminationDate && logical.getTime() > toDateOnly(employment.terminationDate).getTime()) {
      throw new AppError(422, 'After employment termination');
    }

    const existing = await prisma.hcmAttendanceDay.findFirst({
      where: { employmentId, logicalWorkDate: logical },
    });
    if (existing?.status === 'LOCKED') {
      await prisma.hcmTimeException.create({
        data: {
          companyId,
          employmentId,
          employeeId: employment.employeeId,
          attendanceDayId: existing.id,
          logicalWorkDate: logical,
          exceptionType: 'LATE_PUNCH_AFTER_LOCK',
          severity: 'WARNING',
          status: 'OPEN',
        },
      });
      return existing;
    }

    const resolved = await scheduleResolutionService.resolve(
      companyId,
      employmentId,
      logical,
      timezone
    );
    const policyRow = await this.getActivePolicyRow(companyId, logical);
    const policy = (policyRow?.rules as AttendancePolicyRules) ?? DEFAULT_POLICY_RULES;

    let scheduledStartAt: Date | null = null;
    let scheduledEndAt: Date | null = null;
    let scheduledMinutes = 0;
    let shiftId: string | null = null;
    const scheduleId: string | null = resolved.schedule?.id ?? null;
    const workLike = new Set([
      'SCHEDULED_WORK',
      'PUBLIC_HOLIDAY',
      'COMPANY_HOLIDAY',
    ]);

    if (resolved.shift && workLike.has(resolved.dayClassification)) {
      shiftId = resolved.shift.id;
      const bounds = scheduleResolutionService.shiftBounds(resolved.shift, logical, timezone);
      scheduledStartAt = bounds.scheduledStartAt;
      scheduledEndAt = bounds.scheduledEndAt;
      scheduledMinutes = bounds.scheduledMinutes;
    }

    let windowStart = new Date(logical);
    let windowEnd = new Date(logical.getTime() + 86400_000);
    if (resolved.shift) {
      const win = punchMatchingWindow(resolved.shift, logical, timezone);
      windowStart = win.windowStart;
      windowEnd = win.windowEnd;
    }

    const punches = await prisma.hcmTimePunch.findMany({
      where: {
        companyId,
        employmentId,
        punchedAt: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { punchedAt: 'asc' },
    });

    const appliedCorrection = await prisma.hcmTimeCorrection.findFirst({
      where: {
        companyId,
        employmentId,
        logicalWorkDate: logical,
        status: { in: ['APPROVED', 'APPLIED'] },
      },
      orderBy: { appliedAt: 'desc' },
    });
    let punchList = punches;
    if (appliedCorrection?.payload && typeof appliedCorrection.payload === 'object') {
      const p = appliedCorrection.payload as { addPunches?: Array<{ at: string; type: string }> };
      for (const add of p.addPunches ?? []) {
        punchList = [
          ...punchList,
          {
            id: `corr-${add.at}`,
            punchedAt: new Date(add.at),
            punchType: add.type,
          } as (typeof punchList)[0],
        ];
      }
    }

    const { intervals: rawIntervals, exceptions } = matchPunches(punchList);
    const intervals = rawIntervals.map((iv) => {
      const inAt = iv.inAt
        ? interpretClockInstant(iv.inAt, timezone, policy.rounding?.clockIn)
        : null;
      const outAt = iv.outAt
        ? interpretClockInstant(iv.outAt, timezone, policy.rounding?.clockOut)
        : null;
      const workedMinutes =
        inAt && outAt ? clampMinutes((outAt.getTime() - inAt.getTime()) / 60_000) : iv.workedMinutes;
      return { ...iv, inAt, outAt, workedMinutes };
    });
    let workedMinutes = intervals.reduce((s, i) => s + i.workedMinutes, 0);
    workedMinutes = roundMinutes(workedMinutes, policy.rounding?.worked);

    const firstIn = intervals.find((i) => i.inAt)?.inAt ?? null;
    const lastOut = intervals.filter((i) => i.outAt).pop()?.outAt ?? null;

    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let absenceMinutes = 0;
    let detectedOvertimeMinutes = 0;

    let rawLateMinutes = 0;
    if (scheduledStartAt && firstIn) {
      rawLateMinutes = clampMinutes((firstIn.getTime() - scheduledStartAt.getTime()) / 60_000);
      lateMinutes = computeLateMinutes(scheduledStartAt, firstIn, policy);
    }
    if (scheduledEndAt && lastOut) {
      earlyLeaveMinutes = computeEarlyLeaveMinutes(scheduledEndAt, lastOut, policy);
    }
    const graceExcusedStartMinutes = Math.max(0, rawLateMinutes - lateMinutes);
    if (workLike.has(resolved.dayClassification) && scheduledMinutes > 0 && !firstIn && !lastOut) {
      absenceMinutes = scheduledMinutes;
    } else if (scheduledMinutes > 0) {
      absenceMinutes = clampMinutes(
        scheduledMinutes - workedMinutes - lateMinutes - graceExcusedStartMinutes
      );
    }

    if (scheduledEndAt && lastOut && lastOut.getTime() > scheduledEndAt.getTime()) {
      detectedOvertimeMinutes = diffMinutesUtc(scheduledEndAt, lastOut);
      const minOt = policy.minimumOvertimeMinutes ?? 0;
      if (detectedOvertimeMinutes < minOt) detectedOvertimeMinutes = 0;
      detectedOvertimeMinutes = roundMinutes(detectedOvertimeMinutes, policy.rounding?.overtime);
    }

    const breakMinutes = resolved.shift?.unpaidBreakMinutes ?? 0;
    workedMinutes = clampMinutes(workedMinutes - breakMinutes);

    let paidLeaveMinutes = 0;
    let unpaidLeaveMinutes = 0;
    let sickLeaveMinutes = 0;
    let otherApprovedLeaveMinutes = 0;
    let dayClassificationOut = resolved.dayClassification;

    const leaveOverlay = await leaveTimeOverlayService.getApprovedOverlay(
      companyId,
      employmentId,
      logical
    );
    if (leaveOverlay) {
      paidLeaveMinutes = leaveOverlay.paidLeaveMinutes;
      unpaidLeaveMinutes = leaveOverlay.unpaidLeaveMinutes;
      sickLeaveMinutes = leaveOverlay.sickLeaveMinutes;
      otherApprovedLeaveMinutes = leaveOverlay.otherApprovedLeaveMinutes;
      const totalLeave = leaveOverlay.excusedMinutes;
      if (leaveOverlay.fullDayLeave && workLike.has(resolved.dayClassification)) {
        absenceMinutes = 0;
        lateMinutes = 0;
        earlyLeaveMinutes = 0;
        dayClassificationOut = leaveOverlay.attendanceClassification;
      } else if (totalLeave > 0) {
        absenceMinutes = clampMinutes(Math.max(0, absenceMinutes - totalLeave));
        const scheduledEnd = scheduledEndAt;
        if (scheduledEnd && lastOut && earlyLeaveMinutes > 0) {
          earlyLeaveMinutes = clampMinutes(Math.max(0, earlyLeaveMinutes - totalLeave));
        }
      }
    }

    const preservedApprovedOt = existing?.approvedOvertimeMinutes ?? 0;
    const approvedOvertimeMinutes = Math.min(
      preservedApprovedOt,
      detectedOvertimeMinutes
    );

    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          punches: punchList.map((p) => p.id),
          correctionId: appliedCorrection?.id ?? null,
          scheduleId,
          policyId: policyRow?.id ?? null,
          scheduledMinutes,
          policy,
          logical: logical.toISOString(),
          leaveOverlay,
        })
      )
      .digest('hex');

    let dayRow;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        dayRow = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.hcmWorkInterval.deleteMany({ where: { attendanceDayId: existing.id } });
        await tx.hcmTimeException.deleteMany({
          where: { attendanceDayId: existing.id, status: 'OPEN' },
        });
      }

      const row = existing
        ? await tx.hcmAttendanceDay.update({
            where: { id: existing.id },
            data: {
              scheduleId,
              shiftId,
              scheduledStartAt,
              scheduledEndAt,
              actualFirstInAt: firstIn,
              actualLastOutAt: lastOut,
              scheduledMinutes,
              workedMinutes,
              lateMinutes,
              earlyLeaveMinutes,
              absenceMinutes,
              breakMinutes,
              detectedOvertimeMinutes,
              approvedOvertimeMinutes,
              paidLeaveMinutes,
              unpaidLeaveMinutes,
              sickLeaveMinutes,
              otherApprovedLeaveMinutes,
              dayClassification: dayClassificationOut,
              status: 'CALCULATED',
              calculationVersion: existing.calculationVersion + 1,
              calculationHash: hash,
              calculatedAt: new Date(),
            },
          })
        : await tx.hcmAttendanceDay.create({
            data: {
              companyId,
              employmentId,
              employeeId: employment.employeeId,
              logicalWorkDate: logical,
              timezone,
              scheduleId,
              shiftId,
              scheduledStartAt,
              scheduledEndAt,
              actualFirstInAt: firstIn,
              actualLastOutAt: lastOut,
              scheduledMinutes,
              workedMinutes,
              lateMinutes,
              earlyLeaveMinutes,
              absenceMinutes,
              breakMinutes,
              detectedOvertimeMinutes,
              approvedOvertimeMinutes: 0,
              paidLeaveMinutes,
              unpaidLeaveMinutes,
              sickLeaveMinutes,
              otherApprovedLeaveMinutes,
              dayClassification: dayClassificationOut,
              status: 'CALCULATED',
              calculationHash: hash,
              calculatedAt: new Date(),
            },
          });

      for (let i = 0; i < intervals.length; i++) {
        const iv = intervals[i];
        await tx.hcmWorkInterval.create({
          data: {
            companyId,
            attendanceDayId: row.id,
            sequence: i + 1,
            inAt: iv.inAt,
            outAt: iv.outAt,
            workedMinutes: iv.workedMinutes,
          },
        });
      }

      if (resolved.dayClassification === 'NO_SCHEDULE') {
        await tx.hcmTimeException.create({
          data: {
            companyId,
            employmentId,
            employeeId: employment.employeeId,
            attendanceDayId: row.id,
            logicalWorkDate: logical,
            exceptionType: 'NO_SCHEDULE',
            severity: 'WARNING',
            status: 'OPEN',
          },
        });
      }
      for (const ex of exceptions) {
        await tx.hcmTimeException.create({
          data: {
            companyId,
            employmentId,
            employeeId: employment.employeeId,
            attendanceDayId: row.id,
            logicalWorkDate: logical,
            exceptionType: ex.type,
            severity: 'WARNING',
            status: 'OPEN',
            details: ex.details ?? {},
          },
        });
      }
      const approvedOt =
        row.approvedOvertimeMinutes ??
        (existing ? approvedOvertimeMinutes : 0);
      if (detectedOvertimeMinutes > 0 && approvedOt < detectedOvertimeMinutes) {
        await tx.hcmTimeException.create({
          data: {
            companyId,
            employmentId,
            employeeId: employment.employeeId,
            attendanceDayId: row.id,
            logicalWorkDate: logical,
            exceptionType: 'OVERTIME_REQUIRES_APPROVAL',
            severity: 'INFO',
            status: 'OPEN',
            details: { detectedOvertimeMinutes },
          },
        });
      }
      return row;
    });
        break;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'P2034' && attempt < 2) continue;
        throw err;
      }
    }

    return dayRow!;
  }

  async approveOvertime(
    companyId: string,
    attendanceDayId: string,
    approvedMinutes: number,
    approverId?: string
  ) {
    const day = await prisma.hcmAttendanceDay.findFirst({ where: { id: attendanceDayId, companyId } });
    if (!day) throw new AppError(404, 'Attendance day not found');
    if (day.status === 'LOCKED') throw new AppError(422, 'Day is locked');
    const approved = clampMinutes(approvedMinutes);
    if (approved > day.detectedOvertimeMinutes) {
      throw new AppError(422, 'Approved overtime cannot exceed detected');
    }
    const updated = await prisma.hcmAttendanceDay.update({
      where: { id: attendanceDayId },
      data: { approvedOvertimeMinutes: approved },
    });
    if (approved >= day.detectedOvertimeMinutes) {
      await prisma.hcmTimeException.updateMany({
        where: {
          companyId,
          attendanceDayId,
          exceptionType: 'OVERTIME_REQUIRES_APPROVAL',
          status: 'OPEN',
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedBy: approverId ?? null,
          resolution: 'OVERTIME_APPROVED',
        },
      });
    }
    return updated;
  }

  async rejectOvertime(companyId: string, attendanceDayId: string, userId: string) {
    const day = await prisma.hcmAttendanceDay.findFirst({ where: { id: attendanceDayId, companyId } });
    if (!day) throw new AppError(404, 'Attendance day not found');
    if (day.status === 'LOCKED') throw new AppError(422, 'Day is locked');
    await prisma.hcmAttendanceDay.update({
      where: { id: attendanceDayId },
      data: { approvedOvertimeMinutes: 0 },
    });
    await prisma.hcmTimeException.updateMany({
      where: {
        companyId,
        attendanceDayId,
        exceptionType: 'OVERTIME_REQUIRES_APPROVAL',
        status: 'OPEN',
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: userId,
        resolution: 'OVERTIME_REJECTED',
      },
    });
  }

  async unlockDay(companyId: string, attendanceDayId: string, userId: string, reason: string) {
    const day = await prisma.hcmAttendanceDay.findFirst({ where: { id: attendanceDayId, companyId } });
    if (!day) throw new AppError(404, 'Not found');
    if (day.status !== 'LOCKED') throw new AppError(400, 'Day is not locked');
    return prisma.hcmAttendanceDay.update({
      where: { id: attendanceDayId },
      data: {
        status: 'CALCULATED',
        lockedAt: null,
        lockedBy: null,
        calculationHash: createHash('sha256')
          .update(`${day.calculationHash ?? ''}|unlock|${userId}|${reason}|${Date.now()}`)
          .digest('hex'),
      },
    });
  }

  async lockDay(companyId: string, attendanceDayId: string, userId: string) {
    const day = await prisma.hcmAttendanceDay.findFirst({ where: { id: attendanceDayId, companyId } });
    if (!day) throw new AppError(404, 'Not found');
    return prisma.hcmAttendanceDay.update({
      where: { id: attendanceDayId },
      data: { status: 'LOCKED', lockedAt: new Date(), lockedBy: userId },
    });
  }
}

export const attendanceCalculationService = new AttendanceCalculationService();
