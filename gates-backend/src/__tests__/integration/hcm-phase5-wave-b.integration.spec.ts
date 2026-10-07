/**
 * Phase 5.1 Wave B — operations UX backend gates.
 */
import { PrismaClient } from '@prisma/client';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import { runPayrollMonth } from '../helpers/hcm-payroll-wave-a3.helpers';
import { payrollRunReadService } from '../../modules/hr/services/payroll/payroll-run-read.service';
import { payrollReportsService } from '../../modules/hr/services/payroll/payroll-reports.service';
import { employee360Service } from '../../modules/hr/services/hcm/employee-360.service';
import { payrollRunCalculationService } from '../../modules/hr/services/payroll/payroll-run-calculation.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('HCM Phase 5.1 Wave B', () => {
  jest.setTimeout(180_000);

  it('run list pagination returns bounded rows', async () => {
    const fx = await createPayrollFixture(prisma);
    await runPayrollMonth(prisma, fx, 1);
    const page = await payrollRunReadService.listRuns(fx.companyId, { page: 1, pageSize: 10 }, true);
    expect(page.total).toBeGreaterThanOrEqual(1);
    expect(page.rows.length).toBeLessThanOrEqual(10);
    expect(page.rows[0]?.gross).toBeGreaterThan(0);
  });

  it('run review includes reconciliation and explainable components', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runPayrollMonth(prisma, fx, 2);
    const review = await payrollRunReadService.getRunReview(fx.companyId, run.id, true);
    expect(review.reconciliation.balanced).toBe(true);
    expect(review.employees[0]?.components.length).toBeGreaterThan(0);
    expect(review.employees[0]?.components[0]?.explanation.title).toBeTruthy();
    expect(review.auditTimeline.length).toBeGreaterThanOrEqual(1);
  });

  it('employee 360 redacts payroll amounts when includePayrollAmounts=false', async () => {
    const fx = await createPayrollFixture(prisma);
    await runPayrollMonth(prisma, fx, 3);
    const view = await employee360Service.getView(fx.companyId, fx.employeeId, {
      includeCompensation: false,
      includePayrollAmounts: false,
    });
    expect(view.payroll.amountsRedacted).toBe(true);
    expect(view.payroll.history[0]?.grossSalary).toBeNull();
    expect(view.payroll.history[0]?.netSalary).toBeNull();
  });

  it('preview is non-mutating (no PayrollRun created)', async () => {
    const fx = await createPayrollFixture(prisma);
    const before = await prisma.payrollRun.count({ where: { companyId: fx.companyId, periodMonth: 4 } });
    await payrollRunCalculationService.previewRun(fx.companyId, 2026, 4);
    const after = await prisma.payrollRun.count({ where: { companyId: fx.companyId, periodMonth: 4 } });
    expect(after).toBe(before);
  });

  it('organizational report uses snapshot cost center dimension', async () => {
    const fx = await createPayrollFixture(prisma);
    const cc = await prisma.costCenter.create({
      data: { companyId: fx.companyId, code: 'CC_WB', arabicName: 'WB CC' },
    });
    await prisma.employee.update({
      where: { id: fx.employeeId },
      data: { costCenterId: cc.id },
    });
    const run = await runPayrollMonth(prisma, fx, 5);
    const byCc = await payrollReportsService.byDimension(fx.companyId, run.id, 'costCenter');
    expect(byCc?.rows.some((r) => r.dimensionId === cc.id)).toBe(true);
    await prisma.employee.update({
      where: { id: fx.employeeId },
      data: { costCenterId: null },
    });
    const byCcAfter = await payrollReportsService.byDimension(fx.companyId, run.id, 'costCenter');
    expect(byCcAfter?.rows.some((r) => r.dimensionId === cc.id)).toBe(true);
  });

  it('report summary totals reconcile with run header', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runPayrollMonth(prisma, fx, 6);
    const summary = await payrollReportsService.payrollSummary(fx.companyId, run.id);
    expect(summary?.totals.gross).toBe(Number(run.totalGross));
    expect(summary?.totals.net).toBe(Number(run.totalNet));
  });
});
