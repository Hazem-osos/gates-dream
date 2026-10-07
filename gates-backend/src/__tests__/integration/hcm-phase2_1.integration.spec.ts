/**
 * HCM Phase 2.1 — timeline, episodes, contracts, headcount.
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/middleware/error-handler';
import { hcmBackfillService } from '../../modules/hr/services/hcm/hcm-backfill.service';
import { hcmTransitionService } from '../../modules/hr/services/hcm/hcm-transition.service';
import { hcmRehireService } from '../../modules/hr/services/hcm/hcm-rehire.service';
import { hcmContractLifecycleService } from '../../modules/hr/services/hcm/hcm-contract-lifecycle.service';
import { hcmHeadcountService } from '../../modules/hr/services/hcm/hcm-headcount.service';
import { hcmEmploymentEventService } from '../../modules/hr/services/hcm/hcm-event.service';
import { employee360Service } from '../../modules/hr/services/hcm/employee-360.service';
import { pickAssignmentAtDate } from '../../modules/hr/services/hcm/employment-assignment.domain';
import { pickCompensationAtDate } from '../../modules/hr/services/hcm/compensation-assignment.domain';
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

describeDb('HCM Phase 2.1 closure', () => {
  jest.setTimeout(120_000);
  const suffix = String(Date.now());
  let companyId: string;
  let employeeId: string;
  let employmentId: string;
  let deptA: string;
  let deptB: string;

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { arabicName: `P21 ${suffix}`, isActive: true } })).id;
    deptA = (
      await prisma.department.create({
        data: { companyId, arabicName: 'A', code: `A-${suffix}`, unitType: 'DEPARTMENT' },
      })
    ).id;
    deptB = (
      await prisma.department.create({
        data: { companyId, arabicName: 'B', code: `B-${suffix}`, unitType: 'DEPARTMENT' },
      })
    ).id;
    employeeId = (
      await prisma.employee.create({
        data: {
          companyId,
          arabicName: 'Phase21',
          departmentId: deptA,
          basicSalary: 20000,
          joinDate: new Date('2026-01-01'),
          identityNumber: `P21${suffix}`.slice(0, 14),
        },
      })
    ).id;
    await hcmBackfillService.backfillCompany(companyId);
    employmentId = (await prisma.hcmEmployment.findFirst({ where: { companyId, employeeId } }))!.id;

    await hcmTransitionService.transitionAssignment(companyId, employmentId, {
      departmentId: deptB,
      effectiveFrom: toDateOnly('2026-07-01'),
      changeReason: 'transfer',
    });
    await hcmTransitionService.transitionCompensation(companyId, employmentId, {
      effectiveFrom: toDateOnly('2026-07-01'),
      basicSalary: 25000,
      changeReason: 'raise',
    });
  });

  afterAll(async () => {
    await prisma.hcmEmploymentEvent.deleteMany({ where: { companyId } });
    await prisma.hcmCompensationAssignment.deleteMany({ where: { companyId } });
    await prisma.hcmEmploymentAssignment.deleteMany({ where: { companyId } });
    await prisma.employeeContract.deleteMany({ where: { employeeId } });
    await prisma.hcmEmployment.deleteMany({ where: { companyId } });
    await prisma.hcmPosition.deleteMany({ where: { companyId } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.department.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('backdated assignment split preserves July transition', async () => {
    await hcmTransitionService.transitionAssignment(companyId, employmentId, {
      departmentId: deptA,
      effectiveFrom: toDateOnly('2026-04-01'),
      changeReason: 'backdate',
    });
    const rows = await prisma.hcmEmploymentAssignment.findMany({
      where: { employmentId, companyId },
    });
    const apr = pickAssignmentAtDate(rows, toDateOnly('2026-04-15'));
    const jun = pickAssignmentAtDate(rows, toDateOnly('2026-06-15'));
    const aug = pickAssignmentAtDate(rows, toDateOnly('2026-08-01'));
    expect(apr?.departmentId).toBe(deptA);
    expect(jun?.departmentId).toBe(deptA);
    expect(aug?.departmentId).toBe(deptB);
  });

  it('backdated compensation split preserves July salary', async () => {
    await hcmTransitionService.transitionCompensation(companyId, employmentId, {
      effectiveFrom: toDateOnly('2026-04-01'),
      basicSalary: 22000,
      changeReason: 'corr',
    });
    const rows = await prisma.hcmCompensationAssignment.findMany({
      where: { employmentId, companyId },
    });
    expect(Number(pickCompensationAtDate(rows, toDateOnly('2026-05-01'))?.basicSalary)).toBe(22000);
    expect(Number(pickCompensationAtDate(rows, toDateOnly('2026-08-01'))?.basicSalary)).toBe(25000);
  });

  it('rehire creates new employment episode', async () => {
    const term = await hcmEmploymentEventService.createDraft(companyId, {
      employmentId,
      eventType: 'TERMINATION',
      effectiveDate: toDateOnly('2026-12-31'),
      payload: {},
    });
    await hcmEmploymentEventService.submit(companyId, term.id, 'u');
    await hcmEmploymentEventService.approve(companyId, term.id, 'a');

    const rehired = await hcmRehireService.rehireEmployee(companyId, {
      employeeId,
      effectiveDate: toDateOnly('2027-02-01'),
      departmentId: deptA,
      basicSalary: 18000,
    });
    expect(rehired.employment.id).not.toBe(employmentId);
    expect(rehired.employment.episodeNumber).toBeGreaterThan(1);
    const old = await prisma.hcmEmployment.findUnique({ where: { id: employmentId } });
    expect(old?.status).toBe('TERMINATED');
    const episodes = await prisma.hcmEmployment.findMany({ where: { companyId, employeeId } });
    expect(episodes.filter((e) => e.status === 'ACTIVE').length).toBe(1);
  });

  it('employee 360 returns multiple episodes', async () => {
    const view = await employee360Service.getView(companyId, employeeId, { includeCompensation: false });
    expect(view.employmentEpisodes?.length).toBeGreaterThanOrEqual(2);
  });

  it('contract lifecycle and historical lookup', async () => {
    const active = await prisma.hcmEmployment.findFirst({
      where: { companyId, employeeId, status: 'ACTIVE' },
    });
    const c1 = await hcmContractLifecycleService.createContract(companyId, active!.id, {
      contractStartDate: toDateOnly('2027-02-01'),
      contractEndDate: toDateOnly('2027-12-31'),
      basicSalary: 18000,
    });
    const c2 = await hcmContractLifecycleService.renewContract(companyId, c1.id, {
      contractStartDate: toDateOnly('2028-01-01'),
      contractEndDate: toDateOnly('2028-12-31'),
    });
    const at = await hcmContractLifecycleService.contractAtDate(active!.id, toDateOnly('2028-06-01'));
    expect(at?.id).toBe(c2.id);
    const old = await prisma.employeeContract.findUnique({ where: { id: c1.id } });
    expect(old?.contractStatus).toBe('SUPERSEDED');
  });

  it('headcount rejects future overlap on single-seat position', async () => {
    const pos = await prisma.hcmPosition.create({
      data: {
        companyId,
        code: `HP-${suffix}`,
        arabicName: 'Solo',
        effectiveFrom: new Date('2026-01-01'),
        headcountLimit: 1,
        isActive: true,
      },
    });
    const emp2 = await prisma.employee.create({
      data: {
        companyId,
        arabicName: 'Second',
        identityNumber: `P22${suffix}`.slice(0, 14),
        joinDate: new Date('2026-01-01'),
        basicSalary: 1,
      },
    });
    await hcmBackfillService.backfillCompany(companyId);
    const emp2Employment = await prisma.hcmEmployment.findFirst({
      where: { companyId, employeeId: emp2.id, status: 'ACTIVE' },
    });
    await hcmTransitionService.transitionAssignment(companyId, emp2Employment!.id, {
      positionId: pos.id,
      effectiveFrom: toDateOnly('2026-10-01'),
      changeReason: 'fill',
    });
    await expect(
      hcmHeadcountService.assertPositionCapacity(companyId, pos.id, toDateOnly('2026-10-15'))
    ).rejects.toBeInstanceOf(AppError);

    await prisma.hcmEmploymentAssignment.updateMany({
      where: { employmentId: emp2Employment!.id, positionId: pos.id },
      data: { effectiveTo: toDateOnly('2026-10-31') },
    });
    await expect(
      hcmHeadcountService.assertPositionCapacity(companyId, pos.id, toDateOnly('2026-11-15'))
    ).resolves.toBeUndefined();
  });
});
