import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { leaveBalanceService } from './leave-balance.service';

export type LeaveSettlementFacts = {
  employmentId: string;
  asOfDate: string;
  terminated: boolean;
  balances: Array<{
    leaveTypeId: string;
    code: string;
    available: string;
    ledgerNet: string;
    encashableHint: boolean;
  }>;
};

/** Factual leave balances at termination — no money calculation. */
export class LeaveTerminationService {
  async settlementFacts(companyId: string, employmentId: string, asOf?: Date): Promise<LeaveSettlementFacts> {
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: employmentId, companyId },
    });
    if (!employment) throw new Error('Employment not found');
    const at = toDateOnly(asOf ?? employment.terminationDate ?? new Date());
    const types = await prisma.hcmLeaveType.findMany({
      where: { companyId, isActive: true },
    });
    const balances = [];
    for (const lt of types) {
      const b = await leaveBalanceService.getLeaveBalance(companyId, employmentId, lt.id, at);
      balances.push({
        leaveTypeId: lt.id,
        code: lt.code,
        available: b.available,
        ledgerNet: b.ledgerNet,
        encashableHint: lt.paidClassification === 'PAID' && lt.requiresBalance,
      });
    }
    return {
      employmentId,
      asOfDate: at.toISOString().slice(0, 10),
      terminated: Boolean(employment.terminationDate),
      balances,
    };
  }
}

export const leaveTerminationService = new LeaveTerminationService();
