/**
 * HR entitlement clearance + payout (EOS / housing / annual leave):
 * the clearance accrues (Dr expense / Cr accrued payroll), the payout pays it
 * from a safe (Dr accrued payroll / Cr safe) and moves the safe cache, and a
 * cancel reverses the payout exactly once.
 *
 * Needs the disposable local MySQL (infra/docker-compose.local-dev-mysql.yml).
 */
import prisma from '../../shared/database/prisma';
import { createPayrollFixture, type PayrollFixture } from '../helpers/hcm-payroll-fixture';
import { clearAnnualLeaveEntitlements } from '../../modules/hr/services/leave-entitlements.service';
import { annualLeaveDisbursementService } from '../../modules/hr/services/annual-leave-disbursement.service';

const USER = 'hcm-payout-test';

// HR journals have no JournalSourceType, so the posting service stores
// sourceType as NULL; they are identified by entryType + sourceId.
async function postedTotals(companyId: string, entryType: string, sourceId: string) {
  const entries = await prisma.journalEntry.findMany({
    where: { companyId, entryType, sourceId, deletedAt: null, isCancelled: false },
    include: { lines: true },
  });
  return entries.map((e) => ({
    isPosted: e.isPosted,
    debit: e.lines.reduce((s, l) => s + Number(l.debitBase ?? l.debit ?? 0), 0),
    credit: e.lines.reduce((s, l) => s + Number(l.creditBase ?? l.credit ?? 0), 0),
  }));
}

describe('HCM entitlement clearance + payout', () => {
  let fx: PayrollFixture;
  let safeId: string;

  beforeAll(async () => {
    fx = await createPayrollFixture(prisma);
    const cash = await prisma.account.create({
      data: { companyId: fx.companyId, code: '1110', arabicName: 'Cash', accountType: 'asset', isActive: true },
    });
    const safe = await prisma.safe.create({
      data: { companyId: fx.companyId, arabicName: 'Main safe', currencyCode: 'EGP', glAccountId: cash.id },
    });
    safeId = safe.id;
  });

  it('accrues the clearance once per year (concurrent duplicates → one 409)', async () => {
    const body = { employeeId: fx.employeeId, date: new Date('2026-06-15'), year: 2026, days: 10, amount: 3000 };
    const results = await Promise.allSettled([
      clearAnnualLeaveEntitlements(fx.companyId, USER, body),
      clearAnnualLeaveEntitlements(fx.companyId, USER, body),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0].reason as { statusCode?: number }).statusCode).toBe(409);

    const procedureId = (ok[0] as PromiseFulfilledResult<{ procedure: { id: string } }>).value.procedure.id;
    const [je] = await postedTotals(fx.companyId, 'AnnualLeaveClearance', procedureId);
    expect(je.isPosted).toBe(true);
    expect(je.debit).toBeCloseTo(3000, 2);
    expect(je.credit).toBeCloseTo(3000, 2);
  });

  it('pays from the safe, moves the safe balance, and cancels exactly once', async () => {
    const before = await prisma.safe.findUniqueOrThrow({ where: { id: safeId } });

    const row = await annualLeaveDisbursementService.createAnnualLeaveDisbursement(fx.companyId, USER, {
      employeeId: fx.employeeId,
      date: new Date('2026-06-20'),
      amount: 3000,
      safeId,
    });
    const [payJe] = await postedTotals(fx.companyId, 'HrPayout', row.id);
    expect(payJe.isPosted).toBe(true);
    expect(payJe.debit).toBeCloseTo(payJe.credit, 4);

    const paid = await prisma.safe.findUniqueOrThrow({ where: { id: safeId } });
    expect(Number(paid.balance) - Number(before.balance)).toBeCloseTo(-3000, 2);

    const cancels = await Promise.allSettled([
      annualLeaveDisbursementService.cancelAnnualLeaveDisbursement(fx.companyId, USER, row.id),
      annualLeaveDisbursementService.cancelAnnualLeaveDisbursement(fx.companyId, USER, row.id),
    ]);
    expect(cancels.filter((c) => c.status === 'fulfilled')).toHaveLength(1);
    const lost = cancels.find((c) => c.status === 'rejected') as PromiseRejectedResult;
    expect((lost.reason as { statusCode?: number }).statusCode).toBe(409);

    const after = await prisma.safe.findUniqueOrThrow({ where: { id: safeId } });
    expect(Number(after.balance)).toBeCloseTo(Number(before.balance), 2);
  });

  it('refuses a payout without a treasury source', async () => {
    await expect(
      annualLeaveDisbursementService.createAnnualLeaveDisbursement(fx.companyId, USER, {
        employeeId: fx.employeeId,
        date: new Date('2026-06-20'),
        amount: 100,
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
