import { PrismaClient } from '@prisma/client';
import type { PayrollFixture } from './hcm-payroll-fixture';

export type AttendanceSeed = {
  logicalWorkDate: string;
  scheduledMinutes?: number;
  workedMinutes?: number;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  absenceMinutes?: number;
  approvedOvertimeMinutes?: number;
  paidLeaveMinutes?: number;
  unpaidLeaveMinutes?: number;
  sickLeaveMinutes?: number;
  dayClassification?: string;
};

export async function seedPayrollAttendance(
  prisma: PrismaClient,
  fx: PayrollFixture,
  days: AttendanceSeed[]
) {
  for (const d of days) {
    const date = new Date(`${d.logicalWorkDate}T12:00:00.000Z`);
    const existing = await prisma.hcmAttendanceDay.findFirst({
      where: {
        companyId: fx.companyId,
        employmentId: fx.employmentId,
        logicalWorkDate: date,
      },
    });
    const data = {
      scheduledMinutes: d.scheduledMinutes ?? 480,
      workedMinutes: d.workedMinutes ?? 480,
      lateMinutes: d.lateMinutes ?? 0,
      earlyLeaveMinutes: d.earlyLeaveMinutes ?? 0,
      absenceMinutes: d.absenceMinutes ?? 0,
      approvedOvertimeMinutes: d.approvedOvertimeMinutes ?? 0,
      paidLeaveMinutes: d.paidLeaveMinutes ?? 0,
      unpaidLeaveMinutes: d.unpaidLeaveMinutes ?? 0,
      sickLeaveMinutes: d.sickLeaveMinutes ?? 0,
      dayClassification: d.dayClassification ?? null,
      status: 'LOCKED',
    };
    if (existing) {
      await prisma.hcmAttendanceDay.update({ where: { id: existing.id }, data });
    } else {
      await prisma.hcmAttendanceDay.create({
        data: {
          companyId: fx.companyId,
          employmentId: fx.employmentId,
          employeeId: fx.employeeId,
          logicalWorkDate: date,
          ...data,
        },
      });
    }
  }
}

export async function componentAmounts(
  prisma: PrismaClient,
  payrollRunId: string,
  employeeId: string
): Promise<Map<string, number>> {
  const item = await prisma.payrollRunItem.findFirst({
    where: { payrollRunId, employeeId },
    include: { components: true },
  });
  const map = new Map<string, number>();
  for (const c of item?.components ?? []) {
    map.set(c.componentCode, (map.get(c.componentCode) ?? 0) + Number(c.amount));
  }
  return map;
}
