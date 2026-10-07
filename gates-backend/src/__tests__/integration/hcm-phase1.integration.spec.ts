/**
 * HCM Phase 1 — employment, assignment, compensation, tenancy.
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/middleware/error-handler';
import { hcmBackfillService } from '../../modules/hr/services/hcm/hcm-backfill.service';
import { hcmPositionService } from '../../modules/hr/services/hcm/hcm-position.service';
import { hcmTransitionService } from '../../modules/hr/services/hcm/hcm-transition.service';
import { employee360Service } from '../../modules/hr/services/hcm/employee-360.service';
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

describeDb('HCM Phase 1 foundation', () => {
  jest.setTimeout(120_000);
  const suffix = String(Date.now());
  let companyA: string;
  let companyB: string;
  let employeeA: string;
  let deptA: string;
  let employmentA: string;

  beforeAll(async () => {
    companyA = (await prisma.company.create({ data: { arabicName: `HCM A ${suffix}`, isActive: true } })).id;
    companyB = (await prisma.company.create({ data: { arabicName: `HCM B ${suffix}`, isActive: true } })).id;
    deptA = (
      await prisma.department.create({
        data: { companyId: companyA, arabicName: 'Finance', code: `FIN-${suffix}`, unitType: 'DEPARTMENT' },
      })
    ).id;
    employeeA = (
      await prisma.employee.create({
        data: {
          companyId: companyA,
          arabicName: 'HCM Test',
          departmentId: deptA,
          basicSalary: 5000,
          joinDate: new Date('2026-01-01'),
          identityNumber: `H${suffix}`.slice(0, 14),
        },
      })
    ).id;
    await hcmBackfillService.backfillCompany(companyA);
    const employment = await prisma.hcmEmployment.findFirst({
      where: { companyId: companyA, employeeId: employeeA },
    });
    employmentA = employment!.id;
  });

  afterAll(async () => {
    await prisma.hcmEmploymentEvent.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.hcmCompensationAssignment.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.hcmEmploymentAssignment.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.hcmEmployment.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.hcmPosition.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.employee.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.department.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA, companyB] } } });
    await prisma.$disconnect();
  });

  it('backfill is idempotent', async () => {
    const second = await hcmBackfillService.backfillCompany(companyA);
    expect(second.employmentsCreated).toBe(0);
    expect(second.skipped).toBeGreaterThanOrEqual(1);
  });

  it('rejects position reporting cycle', async () => {
    const p1 = await hcmPositionService.create(companyA, {
      code: `P1-${suffix}`,
      arabicName: 'Pos 1',
      effectiveFrom: new Date('2026-01-01'),
    });
    const p2 = await hcmPositionService.create(companyA, {
      code: `P2-${suffix}`,
      arabicName: 'Pos 2',
      effectiveFrom: new Date('2026-01-01'),
      reportsToPositionId: p1.id,
    });
    await expect(hcmPositionService.updateReportsTo(companyA, p1.id, p2.id)).rejects.toBeInstanceOf(
      AppError
    );
  });

  it('transitions assignment with historical lookup', async () => {
    const dept2 = await prisma.department.create({
      data: {
        companyId: companyA,
        arabicName: 'HR',
        code: `HR-${suffix}`,
        managementId: null,
        unitType: 'DEPARTMENT',
      },
    });
    await hcmTransitionService.transitionAssignment(companyA, employmentA, {
      departmentId: dept2.id,
      effectiveFrom: toDateOnly('2026-07-01'),
      changeReason: 'transfer',
    });
    const hist = await employee360Service.assignmentAt(companyA, employeeA, '2026-03-01');
    expect(hist.assignment?.departmentId).toBe(deptA);
    const current = await employee360Service.assignmentAt(companyA, employeeA, '2026-10-01');
    expect(current.assignment?.departmentId).toBe(dept2.id);
  });

  it('isolates employment by company', async () => {
    await expect(employee360Service.getView(companyB, employeeA, { includeCompensation: false })).rejects.toBeInstanceOf(
      AppError
    );
  });

  it('employee 360 returns profile without compensation when not requested', async () => {
    const view = await employee360Service.getView(companyA, employeeA, { includeCompensation: false });
    expect(view.profile.id).toBe(employeeA);
    expect(view.currentCompensation).toBeUndefined();
    expect(view.payroll.canonicalSource).toBe('PayrollRun');
  });
});
