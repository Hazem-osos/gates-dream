import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { attendanceCalculationService } from './attendance-calculation.service';
import { logger } from '../../../../shared/logger';

export type BatchRecalcScope =
  | { type: 'employee_day'; employmentId: string; logicalWorkDate: Date; timezone?: string }
  | { type: 'employee_range'; employmentId: string; periodStart: Date; periodEnd: Date; timezone?: string }
  | { type: 'company_day'; logicalWorkDate: Date; timezone?: string }
  | { type: 'company_period'; periodStart: Date; periodEnd: Date; timezone?: string };

export type BatchRecalcResult = {
  queued: number;
  processed: number;
  calculated: number;
  unchanged: number;
  exceptions: number;
  failed: number;
};

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = toDateOnly(start);
  const last = toDateOnly(end);
  while (cur.getTime() <= last.getTime()) {
    days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export class HcmTimeBatchService {
  async recalculateScope(companyId: string, scope: BatchRecalcScope): Promise<BatchRecalcResult> {
    const result: BatchRecalcResult = {
      queued: 0,
      processed: 0,
      calculated: 0,
      unchanged: 0,
      exceptions: 0,
      failed: 0,
    };

    const jobs: Array<{ employmentId: string; day: Date; timezone: string }> = [];

    if (scope.type === 'employee_day') {
      jobs.push({
        employmentId: scope.employmentId,
        day: toDateOnly(scope.logicalWorkDate),
        timezone: scope.timezone ?? 'UTC',
      });
    } else if (scope.type === 'employee_range') {
      for (const day of eachDay(scope.periodStart, scope.periodEnd)) {
        jobs.push({
          employmentId: scope.employmentId,
          day,
          timezone: scope.timezone ?? 'UTC',
        });
      }
    } else if (scope.type === 'company_day') {
      const employments = await prisma.hcmEmployment.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { id: true },
      });
      for (const e of employments) {
        jobs.push({
          employmentId: e.id,
          day: toDateOnly(scope.logicalWorkDate),
          timezone: scope.timezone ?? 'UTC',
        });
      }
    } else {
      const employments = await prisma.hcmEmployment.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { id: true },
      });
      for (const e of employments) {
        for (const day of eachDay(scope.periodStart, scope.periodEnd)) {
          jobs.push({ employmentId: e.id, day, timezone: scope.timezone ?? 'UTC' });
        }
      }
    }

    result.queued = jobs.length;

    for (const job of jobs) {
      result.processed++;
      try {
        const before = await prisma.hcmAttendanceDay.findFirst({
          where: { employmentId: job.employmentId, logicalWorkDate: job.day },
        });
        const after = await attendanceCalculationService.recalculateDay(
          companyId,
          job.employmentId,
          job.day,
          job.timezone
        );
        if (before?.calculationHash && before.calculationHash === after.calculationHash) {
          result.unchanged++;
        } else {
          result.calculated++;
        }
        const openEx = await prisma.hcmTimeException.count({
          where: {
            companyId,
            employmentId: job.employmentId,
            logicalWorkDate: job.day,
            status: 'OPEN',
          },
        });
        result.exceptions += openEx;
      } catch (err) {
        result.failed++;
        logger.warn({ err, companyId, job }, 'HCM batch recalc failed');
      }
    }

    return result;
  }
}

export const hcmTimeBatchService = new HcmTimeBatchService();
