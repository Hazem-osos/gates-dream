import { PrismaClient } from '@prisma/client';
import { hcmBackfillService } from '../../modules/hr/services/hcm/hcm-backfill.service';
import { punchIngestionService } from '../../modules/hr/services/time/punch-ingestion.service';
import { attendanceCalculationService } from '../../modules/hr/services/time/attendance-calculation.service';
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

describeDb('HCM time concurrency', () => {
  jest.setTimeout(120_000);
  let companyId: string;
  let employeeId: string;
  let employmentId: string;

  beforeAll(async () => {
    const suffix = String(Date.now());
    companyId = (await prisma.company.create({ data: { arabicName: `CC ${suffix}`, isActive: true } })).id;
    employeeId = (
      await prisma.employee.create({
        data: {
          companyId,
          arabicName: 'CC',
          joinDate: new Date('2026-01-01'),
          identityNumber: `CC${suffix}`.slice(0, 14),
          basicSalary: 1,
        },
      })
    ).id;
    await hcmBackfillService.backfillCompany(companyId);
    employmentId = (await prisma.hcmEmployment.findFirst({ where: { companyId, employeeId } }))!.id;
  });

  afterAll(async () => {
    await prisma.hcmTimePunch.deleteMany({ where: { companyId } });
    await prisma.hcmAttendanceDay.deleteMany({ where: { companyId } });
    await prisma.hcmEmployment.deleteMany({ where: { companyId } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('duplicate punch ingestion is idempotent under concurrency', async () => {
    const input = {
      source: 'MANUAL',
      punchedAt: new Date('2026-08-01T09:00:00.000Z'),
      timezone: 'UTC',
      punchType: 'IN',
      employeeId,
      externalPunchId: 'race-dup',
    };
    const results = await Promise.allSettled([
      punchIngestionService.ingest(companyId, input),
      punchIngestionService.ingest(companyId, input),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(2);
    const count = await prisma.hcmTimePunch.count({
      where: { companyId, externalPunchId: 'race-dup' },
    });
    expect(count).toBe(1);
  });

  it('parallel recalculation yields one attendance day', async () => {
    const day = toDateOnly('2026-08-02');
    await Promise.allSettled([
      attendanceCalculationService.recalculateDay(companyId, employmentId, day, 'UTC'),
      attendanceCalculationService.recalculateDay(companyId, employmentId, day, 'UTC'),
    ]);
    const rows = await prisma.hcmAttendanceDay.findMany({ where: { employmentId, logicalWorkDate: day } });
    expect(rows.length).toBe(1);
  });
});
