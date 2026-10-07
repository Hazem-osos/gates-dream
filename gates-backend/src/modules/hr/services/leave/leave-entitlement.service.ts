import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { leaveEnrollmentService } from './leave-enrollment.service';
import { leaveLedgerService } from './leave-ledger.service';
import { DEFAULT_LEAVE_POLICY, type LeavePolicyRules, type LeaveTypePolicyRules } from './leave-policy.domain';

export class LeaveEntitlementService {
  async resolveTypeRules(
    companyId: string,
    policyId: string,
    leaveTypeId: string
  ): Promise<LeaveTypePolicyRules> {
    const row = await prisma.hcmLeavePolicyRule.findFirst({
      where: { policyId, leaveTypeId, companyId },
    });
    const policy = await prisma.hcmLeavePolicy.findFirst({ where: { id: policyId, companyId } });
    const base = (policy?.rules as LeavePolicyRules) ?? DEFAULT_LEAVE_POLICY;
    const typeRules = (row?.rules as LeaveTypePolicyRules) ?? {};
    return { ...DEFAULT_LEAVE_POLICY, ...base, ...typeRules };
  }

  prorateAnnualGrant(
    days: number,
    hireDate: Date,
    year: number,
    method: LeavePolicyRules['prorationMethod']
  ): Decimal {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31));
    const hire = toDateOnly(hireDate);
    if (hire.getTime() <= yearStart.getTime()) return new Decimal(days);
    if (method === 'NONE') return new Decimal(days);
    if (method === 'MONTHS') {
      const monthsLeft = 12 - hire.getUTCMonth();
      return new Decimal(days).mul(monthsLeft).div(12);
    }
    const totalDays = (yearEnd.getTime() - yearStart.getTime()) / 86400000 + 1;
    const remaining = (yearEnd.getTime() - hire.getTime()) / 86400000 + 1;
    return new Decimal(days).mul(remaining).div(totalDays);
  }

  async grantAnnualEntitlement(
    companyId: string,
    employmentId: string,
    leaveTypeId: string,
    year: number,
    actorId?: string
  ) {
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: employmentId, companyId },
    });
    if (!employment) throw new Error('Employment not found');
    const grantDate = new Date(Date.UTC(year, 0, 1));
    const enrollment = await leaveEnrollmentService.resolvePolicyAt(companyId, employmentId, grantDate);
    if (!enrollment) return { skipped: true, reason: 'no_enrollment' };
    const rules = await this.resolveTypeRules(companyId, enrollment.policyId, leaveTypeId);
    if (rules.entitlementModel !== 'ANNUAL_GRANT') return { skipped: true, reason: 'not_annual_grant' };
    const annualDays = rules.entitlementDays ?? rules.annualGrantDays ?? 21;
    const qty = this.prorateAnnualGrant(annualDays, employment.hireDate, year, rules.prorationMethod);
    const sourceKey = `entitlement:${employmentId}:${leaveTypeId}:${year}`;
    await leaveLedgerService.postEntry({
      companyId,
      employmentId,
      leaveTypeId,
      effectiveDate: grantDate,
      quantity: qty,
      transactionType: 'ENTITLEMENT',
      sourceKey,
      reason: `Annual entitlement ${year}`,
      createdBy: actorId,
    });
    return { skipped: false, quantity: qty.toString() };
  }
}

export const leaveEntitlementService = new LeaveEntitlementService();
