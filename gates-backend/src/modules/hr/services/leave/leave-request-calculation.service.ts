import { Decimal } from '@prisma/client/runtime/library';
import { scheduleResolutionService } from '../time/schedule-resolution.service';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { leaveEnrollmentService } from './leave-enrollment.service';
import { leaveEntitlementService } from './leave-entitlement.service';
import { DEFAULT_LEAVE_POLICY, type LeavePolicyRules } from './leave-policy.domain';

export type LeaveDayPreview = {
  workDate: string;
  segmentType: string;
  scheduledWork: boolean;
  dayClassification: string;
  chargeableDays: string;
  chargeableMinutes: number;
  excludedReason?: string;
};

export type LeavePreviewResult = {
  days: LeaveDayPreview[];
  totalChargeableDays: string;
  totalChargeableMinutes: number;
  calendarDays: number;
};

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export class LeaveRequestCalculationService {
  async preview(
    companyId: string,
    employmentId: string,
    leaveTypeId: string,
    startDate: Date,
    endDate: Date,
    opts?: {
      segmentType?: 'FULL' | 'HALF_AM' | 'HALF_PM' | 'HOURLY';
      hourlyStart?: Date;
      hourlyEnd?: Date;
      timezone?: string;
    }
  ): Promise<LeavePreviewResult> {
    const start = toDateOnly(startDate);
    const end = toDateOnly(endDate);
    const tz = opts?.timezone ?? 'Africa/Cairo';
    const enrollment = await leaveEnrollmentService.resolvePolicyAt(companyId, employmentId, start);
    const policyRules: LeavePolicyRules = enrollment
      ? {
          ...DEFAULT_LEAVE_POLICY,
          ...(enrollment.policy.rules as LeavePolicyRules),
          ...(await leaveEntitlementService.resolveTypeRules(companyId, enrollment.policyId, leaveTypeId)),
        }
      : DEFAULT_LEAVE_POLICY;

    const days: LeaveDayPreview[] = [];
    let totalDays = new Decimal(0);
    let totalMinutes = 0;
    let calendarDays = 0;

    for (let cur = start; cur.getTime() <= end.getTime(); cur = addDays(cur, 1)) {
      calendarDays += 1;
      const resolved = await scheduleResolutionService.resolve(companyId, employmentId, cur, tz);
      const workLike = resolved.dayClassification === 'SCHEDULED_WORK';
      const isHoliday = resolved.dayClassification === 'PUBLIC_HOLIDAY' || resolved.dayClassification === 'COMPANY_HOLIDAY';
      const isRest = resolved.dayClassification === 'REST_DAY';

      let chargeable = new Decimal(0);
      let chargeableMinutes = 0;
      let excludedReason: string | undefined;
      const segmentType = opts?.segmentType ?? 'FULL';

      if (isRest && !policyRules.countWeekends) {
        excludedReason = 'rest_day';
      } else if (isHoliday && !policyRules.countHolidays) {
        excludedReason = 'holiday';
      } else if (!workLike && !isHoliday && !policyRules.countWeekends) {
        excludedReason = 'non_work_day';
      } else if (segmentType === 'FULL') {
        chargeable = new Decimal(1);
        if (resolved.shift) {
          chargeableMinutes = resolved.shift.expectedWorkMinutes ?? 480;
        }
      } else if (segmentType === 'HALF_AM' || segmentType === 'HALF_PM') {
        if (!policyRules.allowHalfDay) throw new Error('Half-day not allowed');
        chargeable = new Decimal(0.5);
        chargeableMinutes = Math.floor((resolved.shift?.expectedWorkMinutes ?? 480) / 2);
      } else if (segmentType === 'HOURLY' && opts?.hourlyStart && opts?.hourlyEnd) {
        if (!policyRules.allowHourly) throw new Error('Hourly leave not allowed');
        chargeableMinutes = Math.max(
          0,
          Math.floor((opts.hourlyEnd.getTime() - opts.hourlyStart.getTime()) / 60_000)
        );
        const scheduled = resolved.shift?.expectedWorkMinutes ?? 480;
        chargeable = new Decimal(chargeableMinutes).div(scheduled);
      }

      if (!excludedReason) {
        totalDays = totalDays.plus(chargeable);
        totalMinutes += chargeableMinutes;
      }

      days.push({
        workDate: cur.toISOString().slice(0, 10),
        segmentType,
        scheduledWork: workLike,
        dayClassification: resolved.dayClassification,
        chargeableDays: chargeable.toFixed(4),
        chargeableMinutes,
        excludedReason,
      });
    }

    if (policyRules.sandwichRule && days.length >= 2) {
      const hasChargeBefore = (idx: number) =>
        days.slice(0, idx).some((x) => !x.excludedReason && Number(x.chargeableDays) > 0);
      const hasChargeAfter = (idx: number) =>
        days.slice(idx + 1).some((x) => !x.excludedReason && Number(x.chargeableDays) > 0);
      for (let i = 0; i < days.length; i++) {
        const d = days[i];
        if (
          d.excludedReason &&
          (d.excludedReason === 'rest_day' || d.excludedReason === 'holiday') &&
          hasChargeBefore(i) &&
          hasChargeAfter(i)
        ) {
          d.chargeableDays = '1.0000';
          d.chargeableMinutes = 480;
          d.excludedReason = 'sandwich';
          totalDays = totalDays.plus(1);
          totalMinutes += d.chargeableMinutes;
        }
      }
    }

    return {
      days,
      totalChargeableDays: totalDays.toFixed(4),
      totalChargeableMinutes: totalMinutes,
      calendarDays,
    };
  }

}

export const leaveRequestCalculationService = new LeaveRequestCalculationService();
