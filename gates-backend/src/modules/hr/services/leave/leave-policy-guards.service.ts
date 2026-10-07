import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { leaveEnrollmentService } from './leave-enrollment.service';
import { leaveEntitlementService } from './leave-entitlement.service';
import { DEFAULT_LEAVE_POLICY, type LeavePolicyRules } from './leave-policy.domain';

export class LeavePolicyGuardsService {
  async resolveRules(companyId: string, employmentId: string, leaveTypeId: string, at: Date) {
    const enrollment = await leaveEnrollmentService.resolvePolicyAt(companyId, employmentId, at);
    if (!enrollment) return DEFAULT_LEAVE_POLICY;
    return {
      ...DEFAULT_LEAVE_POLICY,
      ...(enrollment.policy.rules as LeavePolicyRules),
      ...(await leaveEntitlementService.resolveTypeRules(companyId, enrollment.policyId, leaveTypeId)),
    };
  }

  async assertRequestAllowed(
    companyId: string,
    employmentId: string,
    leaveTypeId: string,
    startDate: Date,
    attachmentRef?: string | null
  ) {
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: employmentId, companyId },
    });
    if (!employment) throw new AppError(404, 'Employment not found');
    const leaveType = await prisma.hcmLeaveType.findFirst({
      where: { id: leaveTypeId, companyId },
    });
    if (!leaveType) throw new AppError(404, 'Leave type not found');
    if (leaveType.requiresAttachment && !attachmentRef) {
      throw new AppError(422, 'Attachment required');
    }

    const rules = await this.resolveRules(companyId, employmentId, leaveTypeId, startDate);
    const start = toDateOnly(startDate);

    if (employment.probationEnd && start.getTime() <= toDateOnly(employment.probationEnd).getTime()) {
      const mode = rules.probationMode ?? 'ALLOW';
      if (mode === 'NO_USAGE' || mode === 'ACCRUE_ONLY') {
        throw new AppError(422, 'Leave usage blocked during probation');
      }
    }

    if (rules.noticePeriodRestrictsLeave && employment.terminationDate) {
      const term = toDateOnly(employment.terminationDate);
      if (start.getTime() <= term.getTime()) {
        throw new AppError(422, 'Leave restricted during notice period');
      }
    }

    if (employment.hireDate && start.getTime() < toDateOnly(employment.hireDate).getTime()) {
      throw new AppError(422, 'Before hire date');
    }
    if (employment.terminationDate && start.getTime() > toDateOnly(employment.terminationDate).getTime()) {
      throw new AppError(422, 'After termination');
    }
  }
}

export const leavePolicyGuardsService = new LeavePolicyGuardsService();
