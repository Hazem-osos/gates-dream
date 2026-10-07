/**
 * Phase 5.1 Wave B.2 — closure gates (security, scale, compensation).
 */
import { PrismaClient } from '@prisma/client';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import { runPayrollMonth } from '../helpers/hcm-payroll-wave-a3.helpers';
import { payrollRunCalculationService } from '../../modules/hr/services/payroll/payroll-run-calculation.service';
import { payrollReportsService } from '../../modules/hr/services/payroll/payroll-reports.service';
import { payrollCompensationComponentService } from '../../modules/hr/services/payroll/payroll-compensation-component.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('HCM Phase 5.1 Wave B.2', () => {
  jest.setTimeout(300_000);

  it('preview returns engine mode and named blockers without creating run', async () => {
    const fx = await createPayrollFixture(prisma);
    const before = await prisma.payrollRun.count({ where: { companyId: fx.companyId, periodMonth: 6 } });
    const preview = await payrollRunCalculationService.previewRun(fx.companyId, 2026, 6);
    const after = await prisma.payrollRun.count({ where: { companyId: fx.companyId, periodMonth: 6 } });
    expect(after).toBe(before);
    expect(preview.engineMode).toBeTruthy();
    expect(preview.totalEmployees).toBeGreaterThanOrEqual(1);
    expect(preview.totals.employerContributions).toBeDefined();
  });

  it('register report pagination is bounded', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runPayrollMonth(prisma, fx, 7);
    const page1 = await payrollReportsService.payrollRegister(fx.companyId, run.id, { page: 1, pageSize: 1 });
    expect(page1?.rows.length).toBe(1);
    expect(page1?.total).toBeGreaterThanOrEqual(1);
    expect(page1?.totals?.net).toBeGreaterThan(0);
  });

  it('compensation component assignment supports effective-dated change', async () => {
    const fx = await createPayrollFixture(prisma);
    const employment = await prisma.hcmEmployment.findFirst({
      where: { employeeId: fx.employeeId, companyId: fx.companyId },
    });
    expect(employment).toBeTruthy();
    const comp = await prisma.hcmPayComponent.create({
      data: {
        companyId: fx.companyId,
        code: `WB2_${Date.now()}`,
        arabicName: 'WB2 test',
        componentType: 'EARNING',
      },
    });
    await payrollCompensationComponentService.assignComponent(fx.companyId, employment!.id, {
      payComponentId: comp.id,
      amount: 15000,
      effectiveFrom: new Date('2026-03-01'),
    });
    await payrollCompensationComponentService.changeComponentAmount(
      fx.companyId,
      employment!.id,
      comp.id,
      18000,
      new Date('2026-03-16')
    );
    const rows = await payrollCompensationComponentService.listForEmployment(fx.companyId, employment!.id);
    expect(rows.filter((r) => r.code === comp.code).length).toBeGreaterThanOrEqual(2);
  });

  it('synthetic 50-employee register read stays paginated (scale proxy)', async () => {
    const fx = await createPayrollFixture(prisma);
    const batch: string[] = [];
    for (let i = 0; i < 50; i++) {
      const emp = await prisma.employee.create({
        data: {
          companyId: fx.companyId,
          arabicName: `Scale ${i}`,
          serial: `SC${i}`,
          basicSalary: 3000,
          isActive: true,
        },
      });
      batch.push(emp.id);
    }
    const run = await runPayrollMonth(prisma, fx, 9);
    const reg = await payrollReportsService.payrollRegister(fx.companyId, run.id, {
      page: 1,
      pageSize: 50,
    });
    expect(reg?.rows.length).toBeLessThanOrEqual(50);
    expect(reg?.total).toBeGreaterThanOrEqual(batch.length);
  });
});
