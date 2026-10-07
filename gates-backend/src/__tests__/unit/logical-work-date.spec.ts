import { PrismaClient } from '@prisma/client';
import { resolveLogicalWorkDateForPunch } from '../../modules/hr/services/time/logical-work-date.service';
import { hcmBackfillService } from '../../modules/hr/services/hcm/hcm-backfill.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('logical work date overnight', () => {
  jest.setTimeout(120_000);
  let companyId: string;
  let employmentId: string;
  let employeeId: string;
  let nightShiftId: string;

  beforeAll(async () => {
    const suffix = String(Date.now());
    companyId = (await prisma.company.create({ data: { arabicName: `LWD ${suffix}`, isActive: true } })).id;
    employeeId = (
      await prisma.employee.create({
        data: {
          companyId,
          arabicName: 'Night',
          joinDate: new Date('2026-01-01'),
          identityNumber: `NW${suffix}`.slice(0, 14),
          basicSalary: 1,
        },
      })
    ).id;
    await hcmBackfillService.backfillCompany(companyId);
    employmentId = (await prisma.hcmEmployment.findFirst({ where: { companyId, employeeId } }))!.id;
    nightShiftId = (
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
    const schedule = await prisma.hcmWorkSchedule.create({
      data: {
        companyId,
        code: 'NIGHT-SCHED',
        arabicName: 'Night',
        scheduleType: 'FIXED_WEEKLY',
        pattern: { weekly: { '0': nightShiftId, '1': nightShiftId, '2': nightShiftId, '3': nightShiftId, '4': nightShiftId, '5': nightShiftId, '6': nightShiftId } },
      },
    });
    await prisma.hcmEmployeeScheduleAssignment.create({
      data: {
        companyId,
        employmentId,
        scheduleId: schedule.id,
        effectiveFrom: new Date('2026-01-01'),
      },
    });
  });

  afterAll(async () => {
    await prisma.hcmEmployeeScheduleAssignment.deleteMany({ where: { companyId } });
    await prisma.hcmWorkSchedule.deleteMany({ where: { companyId } });
    await prisma.hcmWorkShift.deleteMany({ where: { companyId } });
    await prisma.hcmEmployment.deleteMany({ where: { companyId } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('assigns post-midnight OUT to shift start logical date', async () => {
    const logical = await resolveLogicalWorkDateForPunch(
      companyId,
      employmentId,
      new Date('2026-10-06T06:04:00.000Z'),
      'UTC'
    );
    expect(logical.toISOString().slice(0, 10)).toBe('2026-10-05');
  });

  it('assigns pre-shift IN to same logical date', async () => {
    const logical = await resolveLogicalWorkDateForPunch(
      companyId,
      employmentId,
      new Date('2026-10-05T21:57:00.000Z'),
      'UTC'
    );
    expect(logical.toISOString().slice(0, 10)).toBe('2026-10-05');
  });
});
