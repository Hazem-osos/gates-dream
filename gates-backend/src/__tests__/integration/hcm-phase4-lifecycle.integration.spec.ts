import prisma from '../../shared/database/prisma';
import { createLeaveFixture } from '../helpers/hcm-leave-fixture';
import { leaveTerminationService } from '../../modules/hr/services/leave/leave-termination.service';
import { leaveBalanceService } from '../../modules/hr/services/leave/leave-balance.service';
import { hcmLeaveSetupService } from '../../modules/hr/services/leave/hcm-leave-setup.service';

describe('HCM Phase 4 leave lifecycle', () => {
  it('termination settlement facts and rehire does not merge episodes', async () => {
    const fx = await createLeaveFixture(prisma);
    await prisma.hcmEmployment.update({
      where: { id: fx.employmentId },
      data: { terminationDate: new Date('2026-06-30'), status: 'TERMINATED' },
    });
    const facts = await leaveTerminationService.settlementFacts(fx.companyId, fx.employmentId);
    expect(facts.terminated).toBe(true);
    expect(facts.balances.length).toBeGreaterThan(0);

    const rehire = await prisma.hcmEmployment.create({
      data: {
        companyId: fx.companyId,
        employeeId: fx.employeeId,
        episodeNumber: 2,
        previousEmploymentId: fx.employmentId,
        hireDate: new Date('2027-01-01'),
        status: 'ACTIVE',
      },
    });
    await hcmLeaveSetupService.enrollEmployment(
      fx.companyId,
      rehire.id,
      fx.policyId,
      new Date('2027-01-01')
    );
    const newBal = await leaveBalanceService.getLeaveBalance(
      fx.companyId,
      rehire.id,
      fx.annualTypeId,
      new Date('2027-01-15')
    );
    expect(Number(newBal.ledgerNet)).toBe(0);
  });
});
