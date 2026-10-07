/**
 * End-to-end acceptance: schedule → punches → OT → correction → review → lock
 */
import { PrismaClient } from '@prisma/client';
import { hcmBackfillService } from '../../modules/hr/services/hcm/hcm-backfill.service';
import { punchIngestionService } from '../../modules/hr/services/time/punch-ingestion.service';
import { attendanceCalculationService } from '../../modules/hr/services/time/attendance-calculation.service';
import { timeCorrectionService } from '../../modules/hr/services/time/time-correction.service';
import { timePeriodReviewService } from '../../modules/hr/services/time/time-period-review.service';
import { timePayrollReadService } from '../../modules/hr/services/time/time-payroll-read.service';
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

describeDb('HCM Phase 3 E2E acceptance', () => {
  jest.setTimeout(180_000);
  let companyId: string;
  let employeeId: string;
  let employmentId: string;
  let shiftId: string;
  let scheduleId: string;

  beforeAll(async () => {
    const suffix = String(Date.now());
    companyId = (await prisma.company.create({ data: { arabicName: `E2E ${suffix}`, isActive: true } })).id;
    employeeId = (
      await prisma.employee.create({
        data: {
          companyId,
          arabicName: 'E2E Worker',
          joinDate: new Date('2026-01-01'),
          identityNumber: `E2${suffix}`.slice(0, 14),
          basicSalary: 5000,
        },
      })
    ).id;
    await hcmBackfillService.backfillCompany(companyId);
    employmentId = (await prisma.hcmEmployment.findFirst({ where: { companyId, employeeId } }))!.id;
    shiftId = (
      await prisma.hcmWorkShift.create({
        data: {
          companyId,
          code: `DAY-${suffix}`,
          arabicName: 'Day',
          startTimeMinutes: 9 * 60,
          endTimeMinutes: 17 * 60,
          expectedWorkMinutes: 480,
        },
      })
    ).id;
    const schedule = await prisma.hcmWorkSchedule.create({
      data: {
        companyId,
        code: 'DEFAULT',
        arabicName: 'Default',
        pattern: { weekly: { '0': shiftId, '1': shiftId, '2': shiftId, '3': shiftId, '4': shiftId, '5': shiftId, '6': shiftId } },
      },
    });
    scheduleId = schedule.id;
    await prisma.hcmEmployeeScheduleAssignment.create({
      data: { companyId, employmentId, scheduleId: schedule.id, effectiveFrom: new Date('2026-01-01') },
    });
    await prisma.hcmAttendancePolicy.create({
      data: {
        companyId,
        code: 'STD',
        arabicName: 'Std',
        effectiveFrom: new Date('2026-01-01'),
        rules: { lateGraceMinutes: 10, lateGraceMode: 'FULL', minimumOvertimeMinutes: 30 },
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
    await prisma.hcmEmployment.deleteMany({ where: { companyId } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('runs day/period flow with lock protection', async () => {
    await punchIngestionService.ingest(companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-09-01T09:05:00.000Z'),
      timezone: 'UTC',
      punchType: 'IN',
      employeeId,
      externalPunchId: 'e2e-d1-in',
    });
    await punchIngestionService.ingest(companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-09-01T17:00:00.000Z'),
      timezone: 'UTC',
      punchType: 'OUT',
      employeeId,
      externalPunchId: 'e2e-d1-out',
    });
    const d1 = await prisma.hcmAttendanceDay.findFirst({
      where: { employmentId, logicalWorkDate: toDateOnly('2026-09-01') },
    });
    expect(d1?.lateMinutes).toBe(0);

    await punchIngestionService.ingest(companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-09-02T09:20:00.000Z'),
      timezone: 'UTC',
      punchType: 'IN',
      employeeId,
      externalPunchId: 'e2e-d2-in',
    });
    await punchIngestionService.ingest(companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-09-02T18:10:00.000Z'),
      timezone: 'UTC',
      punchType: 'OUT',
      employeeId,
      externalPunchId: 'e2e-d2-out',
    });
    const d2 = await prisma.hcmAttendanceDay.findFirst({
      where: { employmentId, logicalWorkDate: toDateOnly('2026-09-02') },
    });
    expect((d2?.lateMinutes ?? 0) > 0).toBe(true);
    expect((d2?.detectedOvertimeMinutes ?? 0) >= 30).toBe(true);
    const detected = d2!.detectedOvertimeMinutes;
    await attendanceCalculationService.approveOvertime(companyId, d2!.id, 60, 'mgr');
    const partial = await prisma.hcmAttendanceDay.findUnique({ where: { id: d2!.id } });
    expect(partial?.detectedOvertimeMinutes).toBe(detected);
    expect(partial?.approvedOvertimeMinutes).toBe(60);
    await attendanceCalculationService.approveOvertime(companyId, d2!.id, detected, 'mgr');

    await punchIngestionService.ingest(companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-09-03T09:00:00.000Z'),
      timezone: 'UTC',
      punchType: 'IN',
      employeeId,
      externalPunchId: 'e2e-d3-in',
    });
    const corr = await timeCorrectionService.request(companyId, {
      employmentId,
      logicalWorkDate: toDateOnly('2026-09-03'),
      correctionType: 'MISSING_OUT',
      payload: { addPunches: [{ at: '2026-09-03T17:00:00.000Z', type: 'OUT' }] },
      reason: 'forgot',
    });
    await timeCorrectionService.approve(companyId, corr.id, 'mgr', 'UTC');

    const review = await timePeriodReviewService.assessPeriod(
      companyId,
      toDateOnly('2026-09-01'),
      toDateOnly('2026-09-03')
    );
    expect(review.readiness).toBe('READY');
    await timePeriodReviewService.lockPeriod(
      companyId,
      toDateOnly('2026-09-01'),
      toDateOnly('2026-09-03'),
      'hr'
    );
    const summary = await timePayrollReadService.summarizeEmployeePeriod(
      companyId,
      employmentId,
      toDateOnly('2026-09-01'),
      toDateOnly('2026-09-03')
    );
    expect(summary.workedMinutes).toBeGreaterThan(0);

    const locked = await attendanceCalculationService.recalculateDay(
      companyId,
      employmentId,
      toDateOnly('2026-09-01'),
      'UTC'
    );
    expect(locked.status).toBe('LOCKED');

    const night = await prisma.hcmWorkShift.create({
      data: {
        companyId,
        code: `NIGHT-E2E-${Date.now()}`,
        arabicName: 'Night',
        startTimeMinutes: 22 * 60,
        endTimeMinutes: 6 * 60,
        crossesMidnight: true,
        expectedWorkMinutes: 480,
      },
    });
    await prisma.hcmWorkSchedule.update({
      where: { id: scheduleId },
      data: {
        pattern: {
          weekly: { '0': night.id, '1': night.id, '2': night.id, '3': night.id, '4': night.id, '5': night.id, '6': night.id },
        },
      },
    });
    await punchIngestionService.ingest(companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-09-04T22:00:00.000Z'),
      timezone: 'UTC',
      punchType: 'IN',
      employeeId,
      externalPunchId: 'e2e-night-in',
    });
    await punchIngestionService.ingest(companyId, {
      source: 'MANUAL',
      punchedAt: new Date('2026-09-05T06:00:00.000Z'),
      timezone: 'UTC',
      punchType: 'OUT',
      employeeId,
      externalPunchId: 'e2e-night-out',
    });
    const nightDay = await prisma.hcmAttendanceDay.findFirst({
      where: { employmentId, logicalWorkDate: toDateOnly('2026-09-04') },
    });
    expect(nightDay).toBeTruthy();
    expect(nightDay!.workedMinutes).toBeGreaterThan(0);
  });
});
