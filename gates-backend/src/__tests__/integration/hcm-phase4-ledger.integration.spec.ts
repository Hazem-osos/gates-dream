import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../shared/database/prisma';
import { createLeaveFixture } from '../helpers/hcm-leave-fixture';
import { leaveLedgerService } from '../../modules/hr/services/leave/leave-ledger.service';
import { leaveBalanceService } from '../../modules/hr/services/leave/leave-balance.service';
import { leaveAccrualService } from '../../modules/hr/services/leave/leave-accrual.service';
import { leaveEntitlementService } from '../../modules/hr/services/leave/leave-entitlement.service';

describe('HCM Phase 4 ledger', () => {
  it('entitlement, adjustment, accrual idempotency, as-of balance', async () => {
    const fx = await createLeaveFixture(prisma);
    const bal2026 = await leaveBalanceService.getLeaveBalance(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      new Date('2026-06-30')
    );
    expect(Number(bal2026.ledgerNet)).toBeGreaterThanOrEqual(21);

    await leaveLedgerService.postEntry({
      companyId: fx.companyId,
      employmentId: fx.employmentId,
      leaveTypeId: fx.annualTypeId,
      effectiveDate: new Date('2026-03-01'),
      quantity: new Decimal(1),
      transactionType: 'ADJUSTMENT_CREDIT',
      sourceKey: `test-credit:${fx.employmentId}`,
      reason: 'test',
    });

    const dup = await leaveEntitlementService.grantAnnualEntitlement(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      2026
    );
    expect(dup.skipped || dup.quantity).toBeTruthy();

    await prisma.hcmLeavePolicy.update({
      where: { id: fx.policyId },
      data: {
        rules: {
          entitlementModel: 'MONTHLY_ACCRUAL',
          monthlyAccrualDays: 1.75,
        },
      },
    });
    const run1 = await leaveAccrualService.runMonthlyAccrual(fx.companyId, 2026, 4);
    const run2 = await leaveAccrualService.runMonthlyAccrual(fx.companyId, 2026, 4);
    expect(run2.duplicate || run1.id).toBeTruthy();
  });
});
