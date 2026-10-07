/**
 * HCM Phase 2 — employment lifecycle events.
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/middleware/error-handler';
import { hcmBackfillService } from '../../modules/hr/services/hcm/hcm-backfill.service';
import { hcmEmploymentEventService } from '../../modules/hr/services/hcm/hcm-event.service';
import { hcmHireService } from '../../modules/hr/services/hcm/hcm-hire.service';
import { employee360Service } from '../../modules/hr/services/hcm/employee-360.service';
import { employeeService } from '../../modules/hr/services/employee.service';
import { hcmPayrollImpactService } from '../../modules/hr/services/hcm/hcm-payroll-impact.service';
import { toDateOnly } from '../../modules/hr/utils/hr-effective-date.util';
import { pickCompensationAtDate } from '../../modules/hr/services/hcm/compensation-assignment.domain';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('HCM Phase 2 lifecycle', () => {
  jest.setTimeout(120_000);
  const suffix = String(Date.now());
  let companyId: string;
  let employmentId: string;
  let employeeId: string;
  let deptA: string;
  let deptB: string;

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { arabicName: `P2 ${suffix}`, isActive: true } })).id;
    deptA = (
      await prisma.department.create({
        data: { companyId, arabicName: 'Ops', code: `OPS-${suffix}`, unitType: 'DEPARTMENT' },
      })
    ).id;
    deptB = (
      await prisma.department.create({
        data: { companyId, arabicName: 'Sales', code: `SAL-${suffix}`, unitType: 'DEPARTMENT' },
      })
    ).id;
    const emp = await prisma.employee.create({
      data: {
        companyId,
        arabicName: 'Lifecycle',
        departmentId: deptA,
        basicSalary: 20000,
        joinDate: new Date('2026-01-01'),
        identityNumber: `L${suffix}`.slice(0, 14),
      },
    });
    employeeId = emp.id;
    await hcmBackfillService.backfillCompany(companyId);
    employmentId = (await prisma.hcmEmployment.findFirst({ where: { companyId, employeeId } }))!.id;
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

  async function applyEvent(eventType: string, effectiveDate: string, payload: Record<string, unknown>) {
    const draft = await hcmEmploymentEventService.createDraft(companyId, {
      employmentId,
      eventType,
      effectiveDate: toDateOnly(effectiveDate),
      payload,
    });
    await hcmEmploymentEventService.submit(companyId, draft.id, 'user-1');
    const { event } = await hcmEmploymentEventService.approve(companyId, draft.id, 'mgr-1');
    return event;
  }

  it('hire service creates atomic employment stack', async () => {
    const hired = await hcmHireService.hireEmployee(companyId, {
      arabicName: 'New Hire',
      identityNumber: `H${suffix}2`.slice(0, 14),
      joinDate: new Date('2026-02-01'),
      departmentId: deptA,
      basicSalary: 9000,
    });
    const stack = await prisma.hcmEmployment.findFirst({
      where: { id: hired.employment.id },
      include: { assignments: true },
    });
    expect(stack?.assignments.length).toBe(1);
    await prisma.hcmEmploymentEvent.deleteMany({ where: { employmentId: hired.employment.id } });
    await prisma.hcmCompensationAssignment.deleteMany({ where: { employmentId: hired.employment.id } });
    await prisma.hcmEmploymentAssignment.deleteMany({ where: { employmentId: hired.employment.id } });
    await prisma.hcmEmployment.delete({ where: { id: hired.employment.id } });
    await prisma.employee.delete({ where: { id: hired.employee.id } });
  });

  it('transfer via event updates assignment at effective date', async () => {
    await applyEvent('TRANSFER', '2026-11-01', { departmentId: deptB });
    const at = await employee360Service.assignmentAt(companyId, employeeId, '2026-11-15');
    expect(at.assignment?.departmentId).toBe(deptB);
    const before = await employee360Service.assignmentAt(companyId, employeeId, '2026-06-01');
    expect(before.assignment?.departmentId).toBe(deptA);
  });

  it('promotion changes assignment and compensation atomically', async () => {
    await applyEvent('PROMOTION', '2027-06-01', {
      departmentId: deptB,
      basicSalary: 25000,
    });
    const comps = await prisma.hcmCompensationAssignment.findMany({
      where: { employmentId, companyId },
    });
    const atJul = pickCompensationAtDate(comps, toDateOnly('2027-07-01'));
    expect(Number(atJul?.basicSalary)).toBe(25000);
    const atJun = pickCompensationAtDate(comps, toDateOnly('2026-06-01'));
    expect(Number(atJun?.basicSalary)).toBe(20000);
  });

  it('blocks direct employee salary update when HCM exists', async () => {
    await expect(
      employeeService.updateEmployee(companyId, employeeId, { basicSalary: 1 })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('employee 360 includes lifecycle events', async () => {
    const view = await employee360Service.getView(companyId, employeeId, { includeCompensation: true });
    expect(view.lifecycleEvents?.length).toBeGreaterThan(0);
    expect(view.lifecycleEvents?.some((e) => e.status === 'APPLIED')).toBe(true);
  });

  it('payroll impact detection returns structured result', async () => {
    const impact = await hcmPayrollImpactService.detectImpactForEmployee(
      companyId,
      employeeId,
      toDateOnly('2020-01-01')
    );
    expect(impact).toHaveProperty('impacted');
  });

  it('double apply is idempotent', async () => {
    const draft = await hcmEmploymentEventService.createDraft(companyId, {
      employmentId,
      eventType: 'SALARY_CHANGE',
      effectiveDate: toDateOnly('2028-01-01'),
      payload: { basicSalary: 30000 },
    });
    await hcmEmploymentEventService.submit(companyId, draft.id, 'u');
    await hcmEmploymentEventService.approve(companyId, draft.id, 'a');
    const again = await hcmEmploymentEventService.applyEvent(companyId, draft.id);
    expect(again.status).toBe('APPLIED');
  });
});
