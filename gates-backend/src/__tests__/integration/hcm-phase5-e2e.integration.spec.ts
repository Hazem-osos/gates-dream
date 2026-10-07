/**
 * HCM Phase 5 — canonical payroll E2E (TEST rules/statutory only).
 */
import { PrismaClient } from '@prisma/client';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import { payrollRunCalculationService } from '../../modules/hr/services/payroll/payroll-run-calculation.service';
import { payrollWorkflowService } from '../../modules/hr/services/payroll/payroll-workflow.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('HCM Phase 5 — payroll E2E', () => {
  jest.setTimeout(180_000);

  it('calculates with RULE_ENGINE and component breakdown', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await payrollRunCalculationService.createPayrollRun(fx.companyId, {
      periodYear: 2026,
      periodMonth: 1,
      branchId: fx.branchId,
      fiscalYearId: fx.fiscalYearId,
    });
    expect(run.calculationMode).toBe('RULE_ENGINE');
    expect(run.status).toBe('CALCULATED');
    const item = await prisma.payrollRunItem.findFirst({
      where: { payrollRunId: run.id, employeeId: fx.employeeId },
      include: { components: true },
    });
    expect(item).toBeTruthy();
    expect(item!.components.length).toBeGreaterThan(3);
    const snap = await prisma.hcmPayrollRunSnapshot.findUnique({ where: { payrollRunId: run.id } });
    expect(snap?.ruleSetFingerprint).toBeTruthy();
  });

  it('historical payslip unchanged after salary change', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await payrollRunCalculationService.createPayrollRun(fx.companyId, {
      periodYear: 2026,
      periodMonth: 2,
    });
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'test-approver');
    const before = await prisma.payrollRunItem.findFirst({
      where: { payrollRunId: run.id, employeeId: fx.employeeId },
      include: { components: true },
    });
    const netBefore = Number(before!.netSalary);

    await prisma.employee.update({
      where: { id: fx.employeeId },
      data: { basicSalary: 99999 },
    });
    await prisma.hcmCompensationComponentAssignment.updateMany({
      where: { employmentId: fx.employmentId },
      data: { amount: 99999 },
    });

    const after = await prisma.payrollRunItem.findFirst({
      where: { payrollRunId: run.id, employeeId: fx.employeeId },
    });
    expect(Number(after!.netSalary)).toBe(netBefore);
  });
});
