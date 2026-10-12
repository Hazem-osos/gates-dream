/**
 * Phase 5.1 Wave B.3 — scale read, report totals, query bounds.
 */
import { PrismaClient } from '@prisma/client';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import { runPayrollMonth } from '../helpers/hcm-payroll-wave-a3.helpers';
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

describeDb('HCM Phase 5.1 Wave B.3', () => {
  jest.setTimeout(600_000);

  it('register read for 1000+ employees uses server totals and pagination', async () => {
    const fx = await createPayrollFixture(prisma);
    const tag = `B3SCALE${Date.now()}`;
    const batch = Array.from({ length: 1000 }, (_, i) => ({
      companyId: fx.companyId,
      arabicName: `B3 ${i}`,
      serial: `${tag}${i}`,
      basicSalary: 2500 + (i % 50),
      isActive: true,
    }));
    await prisma.employee.createMany({ data: batch });

    const run = await runPayrollMonth(prisma, fx, 11);
    const page1 = await payrollReportsService.payrollRegister(fx.companyId, run.id, {
      page: 1,
      pageSize: 50,
    });
    const page2 = await payrollReportsService.payrollRegister(fx.companyId, run.id, {
      page: 2,
      pageSize: 50,
    });
    const summary = await payrollReportsService.payrollSummary(fx.companyId, run.id);

    expect(page1?.total).toBeGreaterThanOrEqual(1001);
    expect(page1?.rows.length).toBe(50);
    expect(page2?.rows.length).toBe(50);
    expect(page1?.totals?.net).toBe(summary?.totals.net);
    expect(page1?.totals?.gross).toBe(summary?.totals.gross);
  });
});
