/**
 * HCM Phase 3 — end-to-end time pipeline.
 */
import { PrismaClient } from '@prisma/client';
import { hcmBackfillService } from '../../modules/hr/services/hcm/hcm-backfill.service';
import { punchIngestionService } from '../../modules/hr/services/time/punch-ingestion.service';
import { attendanceCalculationService } from '../../modules/hr/services/time/attendance-calculation.service';
import { timePayrollReadService } from '../../modules/hr/services/time/time-payroll-read.service';
import { timePeriodReviewService } from '../../modules/hr/services/time/time-period-review.service';
import { toDateOnly } from '../../modules/hr/utils/hr-effective-date.util';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('HCM Phase 3 time engine', () => {
  jest.setTimeout(120_000);
  const suffix = String(Date.now());
  let companyId: string;
  let employeeId: string;
  let employmentId: string;
  let shiftId: string;
  let scheduleId: string;

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { arabicName: `T3 ${suffix}`, isActive: true } })).id;
    employeeId = (
      await prisma.employee.create({
        data: {
          companyId,
          arabicName: 'Time Worker',
          joinDate: new Date('2026-01-01'),
          identityNumber: `T3${suffix}`.slice(0, 14),
          basicSalary: 5000,
        },
      })
    ).id;
    await hcmBackfillService.backfillCompany(companyId);
    employmentId = (await prisma.hcmEmployment.findFirst({ where: { companyId, employeeId } }))!.id;

    const shift = await prisma.hcmWorkShift.create({
      data: {
        companyId,
        code: `DAY-${suffix}`,
        arabicName: 'Day',
        startTimeMinutes: 9 * 60,
        endTimeMinutes: 17 * 60,
        crossesMidnight: false,
        expectedWorkMinutes: 480,
        unpaidBreakMinutes: 0,
      },
    });
    shiftId = shift.id;

    const schedule = await prisma.hcmWorkSchedule.create({
      data: {
        companyId,
        code: 'DEFAULT',
        arabicName: 'Default',
        scheduleType: 'FIXED_WEEKLY',
        pattern: {
          weekly: { '1': shiftId, '2': shiftId, '3': shiftId, '4': shiftId, '5': shiftId },
        },
      },
    });
    scheduleId = schedule.id;

    await prisma.hcmEmployeeScheduleAssignment.create({
      data: {
        companyId,
        employmentId,
        scheduleId,
        effectiveFrom: new Date('2026-01-01'),
      },
    });

    await prisma.hcmAttendancePolicy.create({
      data: {
        companyId,
        code: 'STD',
        arabicName: 'Standard',
        effectiveFrom: new Date('2026-01-01'),
        rules: { lateGraceMinutes: 10, lateGraceMode: 'FULL', minimumOvertimeMinutes: 15 },
      },
    });
  });

  afterAll(async () => {
    await prisma.hcmWorkInterval.deleteMany({ where: { companyId } });
    await prisma.hcmTimeException.deleteMany({ where: { companyId } });
    await prisma.hcmAttendanceDay.deleteMany({ where: { companyId } });
    await prisma.hcmTimePunch.deleteMany({ where: { companyId } });
    await prisma.hcmTimeCorrection.deleteMany({ where: { companyId } });
    await prisma.hcmEmployeeScheduleAssignment.deleteMany({ where: { companyId } });
    await prisma.hcmAttendancePolicy.deleteMany({ where: { companyId } });
    await prisma.hcmWorkSchedule.deleteMany({ where: { companyId } });
    await prisma.hcmWorkShift.deleteMany({ where: { companyId } });
    await prisma.hcmCompensationAssignment.deleteMany({ where: { companyId } });
    await prisma.hcmEmploymentAssignment.deleteMany({ where: { companyId } });
    await prisma.hcmEmployment.deleteMany({ where: { companyId } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('ingests duplicate punch once', async () => {
    const input = {
      source: 'MANUAL',
      punchedAt: new Date('2026-06-02T09:00:00.000Z'),
      timezone: 'UTC',
      punchType: 'IN',
      employeeId,
      externalPunchId: 'dup-1',
      deviceId: null,
    };
    const a = await punchIngestionService.ingest(companyId, input);
    const b = await punchIngestionService.ingest(companyId, input);
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
  });

  it('calculates late within grace and worked minutes', async () => {
    await punchIngestionService.ingest(companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-06-03T09:07:00.000Z'),
      timezone: 'UTC',
      punchType: 'IN',
      employeeId,
      externalPunchId: 'in-603',
    });
    await punchIngestionService.ingest(companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-06-03T17:00:00.000Z'),
      timezone: 'UTC',
      punchType: 'OUT',
      employeeId,
      externalPunchId: 'out-603',
    });
    const day = await prisma.hcmAttendanceDay.findFirst({
      where: { employmentId, logicalWorkDate: toDateOnly('2026-06-03') },
    });
    expect(day?.lateMinutes).toBe(0);
    expect(day?.workedMinutes).toBe(473);
    expect(day?.absenceMinutes).toBe(0);
  });

  it('recalculation is idempotent', async () => {
    const d1 = await attendanceCalculationService.recalculateDay(
      companyId,
      employmentId,
      toDateOnly('2026-06-03'),
      'UTC'
    );
    const d2 = await attendanceCalculationService.recalculateDay(
      companyId,
      employmentId,
      toDateOnly('2026-06-03'),
      'UTC'
    );
    expect(d1.calculationHash).toBe(d2.calculationHash);
  });

  it('locks day and blocks silent recalc', async () => {
    const day = await prisma.hcmAttendanceDay.findFirst({
      where: { employmentId, logicalWorkDate: toDateOnly('2026-06-03') },
    });
    await attendanceCalculationService.lockDay(companyId, day!.id, 'admin');
    const locked = await attendanceCalculationService.recalculateDay(
      companyId,
      employmentId,
      toDateOnly('2026-06-03'),
      'UTC'
    );
    expect(locked.status).toBe('LOCKED');
    const ex = await prisma.hcmTimeException.findFirst({
      where: { attendanceDayId: day!.id, exceptionType: 'LATE_PUNCH_AFTER_LOCK' },
    });
    expect(ex).toBeTruthy();
  });

  it('payroll time summary is read-only facts', async () => {
    const summary = await timePayrollReadService.summarizeEmployeePeriod(
      companyId,
      employmentId,
      toDateOnly('2026-06-01'),
      toDateOnly('2026-06-30')
    );
    expect(summary.workedMinutes).toBeGreaterThan(0);
    expect(summary).toHaveProperty('readyForPayroll');
  });

  it('period review returns readiness', async () => {
    const review = await timePeriodReviewService.assessPeriod(
      companyId,
      toDateOnly('2026-06-01'),
      toDateOnly('2026-06-30')
    );
    expect(['READY', 'NOT_READY']).toContain(review.readiness);
  });
});
