import { PrismaClient } from '@prisma/client';
import { hcmBackfillService } from '../../modules/hr/services/hcm/hcm-backfill.service';
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

describeDb('HCM time lifecycle boundaries', () => {
  jest.setTimeout(60_000);
  let companyId: string;
  let employmentId: string;

  beforeAll(async () => {
    const s = String(Date.now());
    companyId = (await prisma.company.create({ data: { arabicName: `LC ${s}`, isActive: true } })).id;
    const emp = await prisma.employee.create({
      data: {
        companyId,
        arabicName: 'LC',
        joinDate: new Date('2026-06-01'),
        identityNumber: `LC${s}`.slice(0, 14),
        basicSalary: 1,
      },
    });
    await hcmBackfillService.backfillCompany(companyId);
    employmentId = (await prisma.hcmEmployment.findFirst({ where: { companyId, employeeId: emp.id } }))!.id;
  });

  afterAll(async () => {
    await prisma.hcmEmployment.deleteMany({ where: { companyId } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('rejects recalculation before hire', async () => {
    await expect(
      attendanceCalculationService.recalculateDay(companyId, employmentId, toDateOnly('2026-01-01'), 'UTC')
    ).rejects.toThrow();
  });
});
