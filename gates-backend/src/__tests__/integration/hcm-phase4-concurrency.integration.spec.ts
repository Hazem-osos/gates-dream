import prisma from '../../shared/database/prisma';
import { createLeaveFixture } from '../helpers/hcm-leave-fixture';
import { leaveRequestService } from '../../modules/hr/services/leave/leave-request.service';
import { leaveLedgerService } from '../../modules/hr/services/leave/leave-ledger.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('HCM Phase 4 concurrency', () => {
  it('concurrent submits cannot overspend balance', async () => {
    const fx = await createLeaveFixture(prisma);
    await leaveLedgerService.postEntry({
      companyId: fx.companyId,
      employmentId: fx.employmentId,
      leaveTypeId: fx.annualTypeId,
      effectiveDate: new Date('2026-01-01'),
      quantity: new Decimal(16),
      transactionType: 'ADJUSTMENT_DEBIT',
      sourceKey: `debit-test:${fx.employmentId}`,
      reason: 'reduce for test',
    });

    const mkDraft = async (start: string, end: string) =>
      leaveRequestService.createDraft(fx.companyId, {
        employmentId: fx.employmentId,
        employeeId: fx.employeeId,
        leaveTypeId: fx.annualTypeId,
        startDate: new Date(start),
        endDate: new Date(end),
      });

    const [d1, d2] = await Promise.all([
      mkDraft('2026-04-06', '2026-04-09'),
      mkDraft('2026-04-13', '2026-04-16'),
    ]);

    const results = await Promise.allSettled([
      leaveRequestService.submit(fx.companyId, d1.id, 'u1'),
      leaveRequestService.submit(fx.companyId, d2.id, 'u2'),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.filter((r) => r.status === 'rejected').length;
    expect(ok).toBe(1);
    expect(fail).toBe(1);
  });
});
