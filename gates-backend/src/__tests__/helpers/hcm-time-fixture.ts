import { PrismaClient } from '@prisma/client';
import { hcmBackfillService } from '../../modules/hr/services/hcm/hcm-backfill.service';
import type { AttendancePolicyRules } from '../../modules/hr/services/time/time-policy.domain';

export type TimeFixture = {
  companyId: string;
  employeeId: string;
  employmentId: string;
  dayShiftId: string;
  nightShiftId: string;
  scheduleId: string;
};

export async function createTimeFixture(
  prisma: PrismaClient,
  opts?: {
    hireDate?: string;
    policy?: AttendancePolicyRules;
    weeklyShiftId?: 'day' | 'night';
  }
): Promise<TimeFixture> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const companyId = (await prisma.company.create({ data: { arabicName: `TF ${suffix}`, isActive: true } })).id;
  const employeeId = (
    await prisma.employee.create({
      data: {
        companyId,
        arabicName: 'Time Fixture',
        joinDate: new Date(opts?.hireDate ?? '2026-01-01'),
        identityNumber: `TF${suffix}`.replace(/-/g, '').slice(0, 14),
        basicSalary: 1000,
      },
    })
  ).id;
  await hcmBackfillService.backfillCompany(companyId);
  const employmentId = (await prisma.hcmEmployment.findFirst({ where: { companyId, employeeId } }))!.id;

  const dayShiftId = (
    await prisma.hcmWorkShift.create({
      data: {
        companyId,
        code: `DAY-${suffix}`,
        arabicName: 'Day',
        startTimeMinutes: 9 * 60,
        endTimeMinutes: 17 * 60,
        expectedWorkMinutes: 480,
        inWindowStartMinutes: 6 * 60,
        inWindowEndMinutes: 12 * 60,
        outWindowStartMinutes: 15 * 60,
        outWindowEndMinutes: 22 * 60,
      },
    })
  ).id;

  const nightShiftId = (
    await prisma.hcmWorkShift.create({
      data: {
        companyId,
        code: `NIGHT-${suffix}`,
        arabicName: 'Night',
        startTimeMinutes: 22 * 60,
        endTimeMinutes: 6 * 60,
        crossesMidnight: true,
        expectedWorkMinutes: 480,
      },
    })
  ).id;

  const weekly: Record<string, string> = {};
  for (let d = 0; d <= 6; d++) weekly[String(d)] = opts?.weeklyShiftId === 'night' ? nightShiftId : dayShiftId;

  const schedule = await prisma.hcmWorkSchedule.create({
    data: {
      companyId,
      code: `SCH-${suffix}`,
      arabicName: 'Main',
      scheduleType: 'FIXED_WEEKLY',
      pattern: { weekly },
    },
  });

  await prisma.hcmEmployeeScheduleAssignment.create({
    data: {
      companyId,
      employmentId,
      scheduleId: schedule.id,
      effectiveFrom: new Date(opts?.hireDate ?? '2026-01-01'),
    },
  });

  await prisma.hcmAttendancePolicy.create({
    data: {
      companyId,
      code: `POL-${suffix}`,
      arabicName: 'Policy',
      effectiveFrom: new Date('2026-01-01'),
      rules: opts?.policy ?? { lateGraceMinutes: 0, earlyLeaveGraceMinutes: 0, minimumOvertimeMinutes: 0 },
    },
  });

  return { companyId, employeeId, employmentId, dayShiftId, nightShiftId, scheduleId: schedule.id };
}

export async function teardownTimeFixture(prisma: PrismaClient, companyId: string) {
  await prisma.hcmWorkInterval.deleteMany({ where: { companyId } });
  await prisma.hcmTimeException.deleteMany({ where: { companyId } });
  await prisma.hcmAttendanceDay.deleteMany({ where: { companyId } });
  await prisma.hcmTimePunch.deleteMany({ where: { companyId } });
  await prisma.hcmTimeCorrection.deleteMany({ where: { companyId } });
  await prisma.hcmCalendarDay.deleteMany({ where: { companyId } });
  await prisma.hcmEmployeeScheduleAssignment.deleteMany({ where: { companyId } });
  await prisma.hcmAttendancePolicy.deleteMany({ where: { companyId } });
  await prisma.hcmWorkSchedule.deleteMany({ where: { companyId } });
  await prisma.hcmWorkShift.deleteMany({ where: { companyId } });
  await prisma.hcmCompensationAssignment.deleteMany({ where: { companyId } });
  await prisma.hcmEmploymentAssignment.deleteMany({ where: { companyId } });
  await prisma.hcmEmployment.deleteMany({ where: { companyId } });
  await prisma.employee.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}
