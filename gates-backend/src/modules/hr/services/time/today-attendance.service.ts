import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { scheduleResolutionService } from './schedule-resolution.service';
import { punchMatchingWindow } from './logical-work-date.service';

export type TodayEmployeeStatus =
  | 'EXPECTED'
  | 'NOT_ARRIVED'
  | 'PRESENT'
  | 'LATE'
  | 'COMPLETED'
  | 'ABSENT'
  | 'REST_DAY'
  | 'HOLIDAY'
  | 'EXCEPTION';

export class TodayAttendanceService {
  async list(
    companyId: string,
    date: Date,
    filters?: { branchId?: string; shiftId?: string },
    timezone = 'UTC'
  ) {
    const logical = toDateOnly(date);
    const now = new Date();
    const employments = await prisma.hcmEmployment.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        hireDate: { lte: logical },
        OR: [{ terminationDate: null }, { terminationDate: { gte: logical } }],
      },
      include: { employee: { select: { id: true, arabicName: true } } },
    });

    const rows = [];
    for (const emp of employments) {
      if (filters?.branchId) {
        const asn = await prisma.hcmEmploymentAssignment.findFirst({
          where: { employmentId: emp.id, companyId, effectiveFrom: { lte: logical } },
          orderBy: { effectiveFrom: 'desc' },
        });
        if (asn?.branchId !== filters.branchId) continue;
      }
      const resolved = await scheduleResolutionService.resolve(companyId, emp.id, logical, timezone);
      if (filters?.shiftId && resolved.shift?.id !== filters.shiftId) continue;

      const day = await prisma.hcmAttendanceDay.findFirst({
        where: { employmentId: emp.id, logicalWorkDate: logical },
      });
      const openEx = await prisma.hcmTimeException.count({
        where: { companyId, employmentId: emp.id, logicalWorkDate: logical, status: 'OPEN' },
      });

      let status: TodayEmployeeStatus = 'EXPECTED';
      if (openEx > 0) status = 'EXCEPTION';
      else if (resolved.dayClassification === 'REST_DAY') status = 'REST_DAY';
      else if (
        resolved.dayClassification === 'PUBLIC_HOLIDAY' ||
        resolved.dayClassification === 'COMPANY_HOLIDAY'
      ) {
        status = 'HOLIDAY';
      } else if (!resolved.shift) {
        status = 'EXPECTED';
      } else {
        const bounds = scheduleResolutionService.shiftBounds(resolved.shift, logical, timezone);
        const win = punchMatchingWindow(resolved.shift, logical, timezone);
        if (day?.actualFirstInAt) {
          status = (day.lateMinutes ?? 0) > 0 ? 'LATE' : 'PRESENT';
          if (day.actualLastOutAt && day.actualLastOutAt >= bounds.scheduledEndAt) {
            status = 'COMPLETED';
          }
        } else if (now.getTime() < bounds.scheduledStartAt.getTime()) {
          status = 'NOT_ARRIVED';
        } else if (now.getTime() <= win.windowEnd.getTime()) {
          status = 'NOT_ARRIVED';
        } else {
          status = 'ABSENT';
        }
      }

      rows.push({
        employmentId: emp.id,
        employeeId: emp.employeeId,
        employeeName: emp.employee.arabicName,
        branchId: null,
        shiftId: resolved.shift?.id ?? null,
        status,
        attendanceDayId: day?.id ?? null,
        openExceptions: openEx,
      });
    }
    return rows;
  }
}

export const todayAttendanceService = new TodayAttendanceService();
