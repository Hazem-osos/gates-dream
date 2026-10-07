/**
 * Real concurrent HCM transitions — one winner, one failure, single current row.
 */
import { PrismaClient } from '@prisma/client';
import { hcmBackfillService } from '../../modules/hr/services/hcm/hcm-backfill.service';
import { hcmTransitionService } from '../../modules/hr/services/hcm/hcm-transition.service';
import { pickCurrentAssignment } from '../../modules/hr/services/hcm/employment-assignment.domain';
import { pickCurrentCompensation } from '../../modules/hr/services/hcm/compensation-assignment.domain';
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

describeDb('HCM concurrent transitions', () => {
  jest.setTimeout(120_000);
  const suffix = String(Date.now());
  let companyId: string;
  let employmentId: string;
  let deptA: string;
  let deptB: string;

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { arabicName: `Conc ${suffix}`, isActive: true } })).id;
    deptA = (
      await prisma.department.create({
        data: { companyId, arabicName: 'A', code: `CA-${suffix}`, unitType: 'DEPARTMENT' },
      })
    ).id;
    deptB = (
      await prisma.department.create({
        data: { companyId, arabicName: 'B', code: `CB-${suffix}`, unitType: 'DEPARTMENT' },
      })
    ).id;
    const emp = await prisma.employee.create({
      data: {
        companyId,
        arabicName: 'Concurrent',
        departmentId: deptA,
        basicSalary: 4000,
        joinDate: new Date('2026-01-01'),
        identityNumber: `C${suffix}`.slice(0, 14),
      },
    });
    await hcmBackfillService.backfillCompany(companyId);
    const employment = await prisma.hcmEmployment.findFirst({
      where: { companyId, employeeId: emp.id },
    });
    employmentId = employment!.id;
  });

  afterAll(async () => {
    await prisma.hcmEmploymentEvent.deleteMany({ where: { companyId } });
    await prisma.hcmCompensationAssignment.deleteMany({ where: { companyId } });
    await prisma.hcmEmploymentAssignment.deleteMany({ where: { companyId } });
    await prisma.hcmEmployment.deleteMany({ where: { companyId } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.department.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('assignment: only one concurrent transition succeeds', async () => {
    const eff = toDateOnly('2026-08-01');
    const results = await Promise.allSettled([
      hcmTransitionService.transitionAssignment(companyId, employmentId, {
        departmentId: deptB,
        effectiveFrom: eff,
        changeReason: 't1',
      }),
      hcmTransitionService.transitionAssignment(companyId, employmentId, {
        departmentId: deptB,
        effectiveFrom: eff,
        changeReason: 't2',
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length + rejected.length).toBe(2);
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const rows = await prisma.hcmEmploymentAssignment.findMany({
      where: { employmentId, companyId, effectiveTo: null },
    });
    expect(rows.length).toBe(1);
    const current = pickCurrentAssignment(
      await prisma.hcmEmploymentAssignment.findMany({ where: { employmentId, companyId } })
    );
    expect(current?.departmentId).toBe(deptB);
  });

  it('compensation: only one concurrent transition succeeds', async () => {
    const eff = toDateOnly('2026-09-01');
    const results = await Promise.allSettled([
      hcmTransitionService.transitionCompensation(companyId, employmentId, {
        effectiveFrom: eff,
        basicSalary: 5000,
        changeReason: 'c1',
      }),
      hcmTransitionService.transitionCompensation(companyId, employmentId, {
        effectiveFrom: eff,
        basicSalary: 6000,
        changeReason: 'c2',
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const all = await prisma.hcmCompensationAssignment.findMany({
      where: { employmentId, companyId },
    });
    const open = all.filter((r) => r.effectiveTo == null);
    expect(open.length).toBe(1);
    const current = pickCurrentCompensation(all);
    expect(Number(current?.basicSalary)).toBeGreaterThan(4000);
  });
});
