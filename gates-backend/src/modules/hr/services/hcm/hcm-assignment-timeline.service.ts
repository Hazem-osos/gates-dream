import type { Prisma } from '@prisma/client';
import { AppError } from '../../../../shared/middleware/error-handler';
import { planTimelineChange } from './hcm-timeline.domain';
import { applyAssignmentTimelinePlan } from './hcm-timeline-apply.util';
import type { AssignmentTransitionInput } from './hcm-transition.service';
import { toDateOnly } from '../../utils/hr-effective-date.util';

function mapTimelineError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === 'TIMELINE_DUPLICATE_BOUNDARY') {
      throw new AppError(409, 'An assignment already starts on this effective date');
    }
    if (error.message === 'TIMELINE_NO_COVERAGE') {
      throw new AppError(422, 'No assignment interval covers the effective date');
    }
  }
  throw error;
}

export async function transitionAssignmentInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  employmentId: string,
  input: AssignmentTransitionInput
) {
  const effectiveFrom = toDateOnly(input.effectiveFrom);
  const existing = await tx.hcmEmploymentAssignment.findMany({
    where: { employmentId, companyId },
  });
  if (existing.length === 0) {
    throw new AppError(422, 'Employment has no assignment baseline');
  }

  const patch = {
    positionId: input.positionId,
    branchId: input.branchId,
    departmentId: input.departmentId,
    jobTitleId: input.jobTitleId,
    jobCadreId: input.jobCadreId,
    managerPositionId: input.managerPositionId,
  };

  let plan;
  try {
    plan = planTimelineChange(existing, effectiveFrom, (source) => ({
      positionId: patch.positionId ?? source.positionId,
      branchId: patch.branchId ?? source.branchId,
      departmentId: patch.departmentId ?? source.departmentId,
      jobTitleId: patch.jobTitleId ?? source.jobTitleId,
      jobCadreId: patch.jobCadreId ?? source.jobCadreId,
      managerPositionId: patch.managerPositionId ?? source.managerPositionId,
      changeReason: input.changeReason ?? source.changeReason,
      sourceProcedureId: input.sourceProcedureId ?? source.sourceProcedureId,
    }));
  } catch (e) {
    mapTimelineError(e);
  }

  return applyAssignmentTimelinePlan(tx, companyId, employmentId, plan, {
    changeReason: input.changeReason,
    sourceProcedureId: input.sourceProcedureId,
    patch: {
      positionId: patch.positionId ?? null,
      branchId: patch.branchId ?? null,
      departmentId: patch.departmentId ?? null,
      jobTitleId: patch.jobTitleId ?? null,
      jobCadreId: patch.jobCadreId ?? null,
      managerPositionId: patch.managerPositionId ?? null,
    },
  });
}
