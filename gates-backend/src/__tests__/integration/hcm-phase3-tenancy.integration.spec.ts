import { PrismaClient } from '@prisma/client';
import { punchIngestionService } from '../../modules/hr/services/time/punch-ingestion.service';
import { attendanceCalculationService } from '../../modules/hr/services/time/attendance-calculation.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('HCM time tenancy', () => {
  jest.setTimeout(120_000);
  let companyA: string;
  let companyB: string;
  let employmentB: string;
  let punchB: string;

  beforeAll(async () => {
    const s = String(Date.now());
    companyA = (await prisma.company.create({ data: { arabicName: `TA ${s}`, isActive: true } })).id;
    companyB = (await prisma.company.create({ data: { arabicName: `TB ${s}`, isActive: true } })).id;
    const emp = await prisma.employee.create({
      data: {
        companyId: companyB,
        arabicName: 'B Worker',
        joinDate: new Date('2026-01-01'),
        identityNumber: `TB${s}`.slice(0, 14),
        basicSalary: 1,
      },
    });
    const { hcmBackfillService } = await import('../../modules/hr/services/hcm/hcm-backfill.service');
    await hcmBackfillService.backfillCompany(companyB);
    employmentB = (await prisma.hcmEmployment.findFirst({ where: { companyId: companyB, employeeId: emp.id } }))!.id;
    const ing = await punchIngestionService.ingest(companyB, {
      source: 'MANUAL',
      punchedAt: new Date('2026-07-01T09:00:00.000Z'),
      timezone: 'UTC',
      punchType: 'IN',
      employeeId: emp.id,
      externalPunchId: `ten-${s}`,
    });
    punchB = ing.punch.id;
  });

  afterAll(async () => {
    await prisma.hcmTimePunch.deleteMany({ where: { companyId: companyB } });
    await prisma.hcmEmployment.deleteMany({ where: { companyId: companyB } });
    await prisma.employee.deleteMany({ where: { companyId: companyB } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA, companyB] } } });
    await prisma.$disconnect();
  });

  it('company A cannot read B punch', async () => {
    const row = await prisma.hcmTimePunch.findFirst({ where: { id: punchB, companyId: companyA } });
    expect(row).toBeNull();
  });

  it('company A cannot recalc B employment', async () => {
    await expect(
      attendanceCalculationService.recalculateDay(
        companyA,
        employmentB,
        new Date('2026-07-01T00:00:00.000Z'),
        'UTC'
      )
    ).rejects.toThrow();
  });
});
