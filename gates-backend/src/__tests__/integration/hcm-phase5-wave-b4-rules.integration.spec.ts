/**
 * Phase 5.1 Wave B.4 — rule admin validation and immutability.
 */
import { PrismaClient } from '@prisma/client';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import { runPayrollMonth } from '../helpers/hcm-payroll-wave-a3.helpers';
import { payrollRuleAdminService } from '../../modules/hr/services/payroll/payroll-rule-admin.service';
import { payrollReportsService } from '../../modules/hr/services/payroll/payroll-reports.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('HCM Phase 5.1 Wave B.4 rules', () => {
  jest.setTimeout(120_000);

  it('rejects invalid formula', () => {
    const r = payrollRuleAdminService.validateRuleInput({ formulaExpr: 'comp_basic +)' });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('blocks formula change when rule used in frozen payroll', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runPayrollMonth(prisma, fx, 8);
    const item = await prisma.payrollRunItem.findFirst({ where: { payrollRunId: run.id } });
    const line = await prisma.hcmPayrollItemComponent.findFirst({
      where: { payrollRunItemId: item!.id },
    });
    expect(line).toBeTruthy();
    const comp = await prisma.hcmPayComponent.findFirst({
      where: { companyId: fx.companyId, code: line!.componentCode },
    });
    const rule = await prisma.hcmPayrollRule.create({
      data: {
        companyId: fx.companyId,
        payComponentId: comp!.id,
        code: `B4IMMUT${Date.now()}`,
        name: 'B4 immut',
        phase: 10,
        priority: 100,
        effectiveFrom: new Date('2026-01-01'),
        formulaExpr: 'comp_basic',
        roundingMode: 'HALF_UP_2',
        isActive: true,
      },
    });
    await prisma.hcmPayrollItemComponent.update({
      where: { id: line!.id },
      data: { ruleId: rule.id, ruleCode: rule.code },
    });
    await expect(
      payrollRuleAdminService.updateRule(fx.companyId, rule.id, { formulaExpr: 'comp_basic * 2' })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('row-level overtime report paginates without changing totals', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runPayrollMonth(prisma, fx, 9);
    const full = await payrollReportsService.overtimeReport(fx.companyId, run.id);
    const p1 = await payrollReportsService.overtimeReport(fx.companyId, run.id, {
      page: 1,
      pageSize: 1,
    });
    expect(p1?.totals?.amount).toBe(full?.totals?.amount);
    expect(p1?.rows.length).toBeLessThanOrEqual(1);
  });
});
