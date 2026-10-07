import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly, isSameDateOnly } from '../../utils/hr-effective-date.util';

export type ConflictVerdict = 'ALLOWED' | 'ALLOWED_WITH_ORDERING' | 'REJECT' | 'REQUIRES_REVIEW';

export type ConflictResult = {
  verdict: ConflictVerdict;
  code: string;
  message?: string;
};

type PendingEvent = {
  eventType: string;
  effectiveDate: Date;
  status: string;
};

const ASSIGNMENT_TYPES = new Set([
  'TRANSFER',
  'PROMOTION',
  'DEMOTION',
  'POSITION_CHANGE',
  'MANAGER_CHANGE',
  'BRANCH_CHANGE',
  'ORG_UNIT_CHANGE',
]);

const COMP_TYPES = new Set(['SALARY_CHANGE', 'COMPENSATION_CHANGE']);

const TERMINATION_TYPES = new Set(['RESIGNATION', 'TERMINATION']);

/**
 * Explicit conflict matrix for employment lifecycle events.
 * See docs/hcm/HCM_EVENT_CONFLICT_MATRIX.md
 */
export class HcmEventConflictService {
  evaluate(
    incoming: { eventType: string; effectiveDate: Date },
    context: {
      employmentStatus: string;
      pendingAndApplied: PendingEvent[];
    }
  ): ConflictResult {
    const E = toDateOnly(incoming.effectiveDate);
    const type = incoming.eventType;

    if (context.employmentStatus === 'TERMINATED') {
      if (type !== 'REHIRE') {
        return { verdict: 'REJECT', code: 'EMPLOYMENT_TERMINATED', message: 'Employment episode is terminated' };
      }
      return { verdict: 'ALLOWED', code: 'REHIRE_AFTER_TERMINATION' };
    }

    if (type === 'REHIRE') {
      return {
        verdict: 'REJECT',
        code: 'REHIRE_ON_ACTIVE_EPISODE',
        message: 'Use rehire service on terminated episode only',
      };
    }

    for (const other of context.pendingAndApplied) {
      if (!['SUBMITTED', 'APPROVED', 'APPLIED'].includes(other.status)) continue;
      const sameDay = isSameDateOnly(toDateOnly(other.effectiveDate), E);

      if (sameDay && ASSIGNMENT_TYPES.has(type) && ASSIGNMENT_TYPES.has(other.eventType)) {
        return { verdict: 'REJECT', code: 'DUPLICATE_ASSIGNMENT_EVENT_DATE' };
      }
      if (sameDay && COMP_TYPES.has(type) && COMP_TYPES.has(other.eventType)) {
        return { verdict: 'REJECT', code: 'DUPLICATE_COMPENSATION_EVENT_DATE' };
      }
      if (type === 'PROMOTION' && other.eventType === 'DEMOTION' && sameDay) {
        return { verdict: 'REJECT', code: 'PROMOTION_DEMOTION_SAME_DAY' };
      }
      if (TERMINATION_TYPES.has(type) && other.eventType === 'SUSPENSION' && sameDay) {
        return { verdict: 'REQUIRES_REVIEW', code: 'TERMINATION_WITH_SUSPENSION' };
      }
      if (
        TERMINATION_TYPES.has(type) &&
        ASSIGNMENT_TYPES.has(other.eventType) &&
        toDateOnly(other.effectiveDate).getTime() > E.getTime()
      ) {
        return { verdict: 'REJECT', code: 'FUTURE_ASSIGNMENT_AFTER_TERMINATION' };
      }
      if (type === 'RETURN_FROM_SUSPENSION' && TERMINATION_TYPES.has(other.eventType)) {
        return { verdict: 'REJECT', code: 'RETURN_AFTER_TERMINATION' };
      }
    }

    if (type.startsWith('CONTRACT_') && context.employmentStatus === 'TERMINATED') {
      return { verdict: 'REJECT', code: 'CONTRACT_ON_TERMINATED_EPISODE' };
    }

    return { verdict: 'ALLOWED', code: 'OK' };
  }

  assertAllowed(result: ConflictResult) {
    if (result.verdict === 'REJECT') {
      throw new AppError(409, result.message ?? result.code);
    }
  }
}

export const hcmEventConflictService = new HcmEventConflictService();
