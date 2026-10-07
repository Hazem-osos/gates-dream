import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { leaveEnrollmentService } from './leave-enrollment.service';
import { leaveLedgerService } from './leave-ledger.service';
import { DEFAULT_LEAVE_POLICY, type LeavePolicyRules } from './leave-policy.domain';

/** Expire carried-forward balance after policy expiry date (e.g. Mar 31). */
export class LeaveExpiryService {
  async runCarryExpiry(
    companyId: string,
    employmentId: string,
    leaveTypeId: string,
    asOf: Date
  ) {
    const at = toDateOnly(asOf);
    const enrollment = await leaveEnrollmentService.resolvePolicyAt(companyId, employmentId, at);
    if (!enrollment) return { skipped: true, reason: 'no_enrollment' };
    const rules = (enrollment.policy.rules as LeavePolicyRules) ?? DEFAULT_LEAVE_POLICY;
    const expMonth = rules.carryForwardExpiryMonth;
    const expDay = rules.carryForwardExpiryDay ?? 31;
    if (!expMonth) return { skipped: true, reason: 'no_expiry_config' };

    const expiryThisYear = new Date(Date.UTC(at.getUTCFullYear(), expMonth - 1, expDay));
    if (at.getTime() < expiryThisYear.getTime()) {
      return { skipped: true, reason: 'before_expiry_date' };
    }

    const year = at.getUTCFullYear();
    const sourceKey = `expiry:${employmentId}:${leaveTypeId}:${year}`;
    const existing = await prisma.hcmLeaveLedgerEntry.findFirst({
      where: { companyId, sourceKey },
    });
    if (existing) return { skipped: true, duplicate: true };

    const carries = await prisma.hcmLeaveLedgerEntry.findMany({
      where: {
        companyId,
        employmentId,
        leaveTypeId,
        transactionType: 'CARRY_FORWARD',
        effectiveDate: { gte: new Date(Date.UTC(year - 1, 0, 1)) },
      },
    });
    if (carries.length === 0) return { skipped: true, reason: 'no_carry' };

    let carryNet = new Decimal(0);
    for (const c of carries) carryNet = carryNet.plus(c.quantity);
    const takenAfterCarry = await prisma.hcmLeaveLedgerEntry.findMany({
      where: {
        companyId,
        employmentId,
        leaveTypeId,
        transactionType: 'LEAVE_TAKEN',
        effectiveDate: { gte: carries[0]!.effectiveDate },
      },
    });
    let taken = new Decimal(0);
    for (const t of takenAfterCarry) taken = taken.plus(t.quantity);
    const toExpire = carryNet.minus(taken);
    if (toExpire.lte(0)) return { skipped: true, reason: 'nothing_to_expire' };

    await leaveLedgerService.postEntry({
      companyId,
      employmentId,
      leaveTypeId,
      effectiveDate: expiryThisYear,
      quantity: toExpire,
      transactionType: 'EXPIRY',
      sourceKey,
      reason: `Carry expiry ${year}`,
    });
    return { expired: toExpire.toString() };
  }
}

export const leaveExpiryService = new LeaveExpiryService();
