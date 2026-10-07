import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';

export type PayrollTimeSummary = {
  employeeId: string;
  employmentId: string;
  periodStart: string;
  periodEnd: string;
  scheduledMinutes: number;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  absenceMinutes: number;
  detectedOvertimeMinutes: number;
  approvedOvertimeMinutes: number;
  paidLeaveMinutes: number;
  unpaidLeaveMinutes: number;
  sickLeaveMinutes: number;
  otherApprovedLeaveMinutes: number;
  restDayWorkMinutes: number;
  holidayWorkMinutes: number;
  unresolvedExceptionCount: number;
  lockedDayCount: number;
  readyForPayroll: boolean;
};

/** Read-only payroll-facing time facts — no money calculation. */
export class TimePayrollReadService {
  async summarizeEmployeePeriod(
    companyId: string,
    employmentId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<PayrollTimeSummary> {
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: employmentId, companyId },
    });
    if (!employment) throw new Error('Employment not found');

    const start = toDateOnly(periodStart);
    const end = toDateOnly(periodEnd);

    const days = await prisma.hcmAttendanceDay.findMany({
      where: {
        companyId,
        employmentId,
        logicalWorkDate: { gte: start, lte: end },
      },
    });

    const unresolvedExceptionCount = await prisma.hcmTimeException.count({
      where: {
        companyId,
        employmentId,
        status: 'OPEN',
        logicalWorkDate: { gte: start, lte: end },
      },
    });

    const agg = days.reduce(
      (a, d) => {
        a.scheduledMinutes += d.scheduledMinutes;
        a.workedMinutes += d.workedMinutes;
        a.lateMinutes += d.lateMinutes;
        a.earlyLeaveMinutes += d.earlyLeaveMinutes;
        a.absenceMinutes += d.absenceMinutes;
        a.detectedOvertimeMinutes += d.detectedOvertimeMinutes;
        a.approvedOvertimeMinutes += d.approvedOvertimeMinutes;
        a.paidLeaveMinutes += d.paidLeaveMinutes;
        a.unpaidLeaveMinutes += d.unpaidLeaveMinutes;
        a.sickLeaveMinutes += d.sickLeaveMinutes;
        a.otherApprovedLeaveMinutes += d.otherApprovedLeaveMinutes;
        if (d.dayClassification === 'REST_DAY') a.restDayWorkMinutes += d.workedMinutes;
        if (d.dayClassification === 'HOLIDAY') a.holidayWorkMinutes += d.workedMinutes;
        if (d.status === 'LOCKED') a.lockedDayCount += 1;
        return a;
      },
      {
        scheduledMinutes: 0,
        workedMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        absenceMinutes: 0,
        detectedOvertimeMinutes: 0,
        approvedOvertimeMinutes: 0,
        paidLeaveMinutes: 0,
        unpaidLeaveMinutes: 0,
        sickLeaveMinutes: 0,
        otherApprovedLeaveMinutes: 0,
        restDayWorkMinutes: 0,
        holidayWorkMinutes: 0,
        lockedDayCount: 0,
      }
    );

    return {
      employeeId: employment.employeeId,
      employmentId,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
      ...agg,
      unresolvedExceptionCount,
      readyForPayroll: unresolvedExceptionCount === 0,
    };
  }
}

export const timePayrollReadService = new TimePayrollReadService();
