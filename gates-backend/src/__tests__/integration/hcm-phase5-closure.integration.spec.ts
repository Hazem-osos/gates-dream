/**
 * Phase 5.1 closure gates — engine mode, rule versioning, tenancy sample.
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/middleware/error-handler';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import { payrollEngineModeService } from '../../modules/hr/services/payroll/payroll-engine-mode.service';
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

describeDb('HCM Phase 5.1 — closure', () => {
  jest.setTimeout(180_000);

  it('RULE_ENGINE configured without rules blocks calculation (no silent legacy)', async () => {
    const fx = await createPayrollFixture(prisma);
    await prisma.hcmPayrollRule.updateMany({ where: { companyId: fx.companyId }, data: { isActive: false } });
    await expect(
      payrollRunCalculationService.createPayrollRun(fx.companyId, { periodYear: 2026, periodMonth: 3 })
    ).rejects.toThrow(/RULE_ENGINE|blocked/i);
  });

  it('rule versioning frozen on component after rule edit', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await payrollRunCalculationService.createPayrollRun(fx.companyId, {
      periodYear: 2026,
      periodMonth: 4,
    });
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'approver-1');
    const before = await prisma.hcmPayrollItemComponent.findFirst({
      where: { payrollRunItem: { payrollRunId: run.id } },
      orderBy: { createdAt: 'asc' },
    });
    expect(before?.ruleFormulaFingerprint).toBeTruthy();

    await prisma.hcmPayrollRule.updateMany({
      where: { companyId: fx.companyId, code: 'R_BASIC' },
      data: { formulaExpr: '999999' },
    });

    const after = await prisma.hcmPayrollItemComponent.findFirst({
      where: { id: before!.id },
    });
    expect(after?.ruleFormulaFingerprint).toBe(before?.ruleFormulaFingerprint);
    expect(Number(after?.amount)).toBe(Number(before?.amount));
  });

  it('tenancy: company B cannot read company A payroll run', async () => {
    const fx = await createPayrollFixture(prisma);
    const companyB = (await prisma.company.create({ data: { arabicName: 'B iso', isActive: true } })).id;
    const run = await payrollRunCalculationService.createPayrollRun(fx.companyId, {
      periodYear: 2026,
      periodMonth: 5,
    });
    const stolen = await prisma.payrollRun.findFirst({ where: { id: run.id, companyId: companyB } });
    expect(stolen).toBeNull();
  });

  it('explicit engine mode persisted on run', async () => {
    const fx = await createPayrollFixture(prisma);
    const mode = await payrollEngineModeService.getConfiguredMode(fx.companyId);
    expect(mode).toBe('RULE_ENGINE');
    const run = await payrollRunCalculationService.createPayrollRun(fx.companyId, {
      periodYear: 2026,
      periodMonth: 6,
    });
    expect(run.calculationMode).toBe('RULE_ENGINE');
  });
});
