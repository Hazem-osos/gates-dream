import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../shared/database/prisma';
import { createLeaveFixture } from '../helpers/hcm-leave-fixture';
import { leaveAccrualService } from '../../modules/hr/services/leave/leave-accrual.service';
import { leaveExpiryService } from '../../modules/hr/services/leave/leave-expiry.service';
import { leaveLedgerService } from '../../modules/hr/services/leave/leave-ledger.service';

describe('HCM Phase 4 carry expiry', () => {
  it('posts EXPIRY ledger after carry expiry date', async () => {
    const fx = await createLeaveFixture(prisma);
    await prisma.hcmLeavePolicy.update({
      where: { id: fx.policyId },
      data: {
        rules: {
          carryForwardMaxDays: 5,
          carryForwardExpiryMonth: 3,
          carryForwardExpiryDay: 31,
        },
      },
    });
    await leaveLedgerService.postEntry({
      companyId: fx.companyId,
      employmentId: fx.employmentId,
      leaveTypeId: fx.annualTypeId,
      effectiveDate: new Date('2026-12-31T00:00:00.000Z'),
      quantity: new Decimal(10),
      transactionType: 'ADJUSTMENT_CREDIT',
      sourceKey: `exp-test-credit:${fx.employmentId}`,
      reason: 'test',
    });
    await leaveAccrualService.runCarryForward(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      new Date('2026-12-31T00:00:00.000Z')
    );
    const exp = await leaveExpiryService.runCarryExpiry(
      fx.companyId,
      fx.employmentId,
      fx.annualTypeId,
      new Date('2027-04-01T00:00:00.000Z')
    );
    expect(exp.expired || exp.skipped).toBeTruthy();
    const expiryRow = await prisma.hcmLeaveLedgerEntry.findFirst({
      where: {
        companyId: fx.companyId,
        employmentId: fx.employmentId,
        transactionType: 'EXPIRY',
      },
    });
    expect(expiryRow).not.toBeNull();
  });
});
