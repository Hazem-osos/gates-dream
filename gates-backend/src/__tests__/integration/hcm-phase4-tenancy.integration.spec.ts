import { PrismaClient } from '@prisma/client';
import { leaveBalanceService } from '../../modules/hr/services/leave/leave-balance.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('HCM leave tenancy', () => {
  jest.setTimeout(120_000);
  let companyA: string;
  let companyB: string;
  let employmentB: string;
  let leaveTypeB: string;

  beforeAll(async () => {
    const s = String(Date.now());
    companyA = (await prisma.company.create({ data: { arabicName: `LA ${s}`, isActive: true } })).id;
    companyB = (await prisma.company.create({ data: { arabicName: `LB ${s}`, isActive: true } })).id;
    const { hcmLeaveSetupService } = await import('../../modules/hr/services/leave/hcm-leave-setup.service');
    const { hcmBackfillService } = await import('../../modules/hr/services/hcm/hcm-backfill.service');
    const emp = await prisma.employee.create({
      data: {
        companyId: companyB,
        arabicName: 'B Leave',
        joinDate: new Date('2026-01-01'),
        identityNumber: `LB${s}`.slice(0, 14),
        basicSalary: 1,
      },
    });
    await hcmBackfillService.backfillCompany(companyB);
    employmentB = (await prisma.hcmEmployment.findFirst({ where: { companyId: companyB, employeeId: emp.id } }))!.id;
    const cat = await hcmLeaveSetupService.bootstrapEmployment(companyB, employmentB, emp.id, new Date('2026-01-01'));
    leaveTypeB = cat.annualTypeId;
  });

  afterAll(async () => {
    await prisma.hcmLeaveLedgerEntry.deleteMany({ where: { companyId: companyB } });
    await prisma.hcmLeaveEnrollment.deleteMany({ where: { companyId: companyB } });
    await prisma.hcmLeaveType.deleteMany({ where: { companyId: companyB } });
    await prisma.hcmLeavePolicy.deleteMany({ where: { companyId: companyB } });
    await prisma.hcmEmployment.deleteMany({ where: { companyId: companyB } });
    await prisma.employee.deleteMany({ where: { companyId: companyB } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA, companyB] } } });
    await prisma.$disconnect();
  });

  it('company A cannot read B leave ledger via employment scope', async () => {
    const row = await prisma.hcmLeaveLedgerEntry.findFirst({
      where: { companyId: companyA, employmentId: employmentB },
    });
    expect(row).toBeNull();
  });

  it('balance service uses company guard', async () => {
    await expect(
      leaveBalanceService.getLeaveBalance(
        companyA,
        employmentB,
        leaveTypeB,
        new Date('2026-06-01')
      )
    ).resolves.toBeDefined();
    const entries = await prisma.hcmLeaveLedgerEntry.findMany({
      where: { companyId: companyA, employmentId: employmentB },
    });
    expect(entries.length).toBe(0);
  });
});
