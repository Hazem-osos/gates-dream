import type { Prisma } from '@prisma/client';
import { AppError } from '../../../../shared/middleware/error-handler';
import { planTimelineChange } from './hcm-timeline.domain';
import { applyCompensationTimelinePlan } from './hcm-timeline-apply.util';
import { toDateOnly } from '../../utils/hr-effective-date.util';

function mapTimelineError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === 'TIMELINE_DUPLICATE_BOUNDARY') {
      throw new AppError(409, 'Compensation already starts on this effective date');
    }
    if (error.message === 'TIMELINE_NO_COVERAGE') {
      throw new AppError(422, 'No compensation interval covers the effective date');
    }
  }
  throw error;
}

export async function transitionCompensationInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  employmentId: string,
  input: {
    effectiveFrom: Date;
    basicSalary: number;
    fixedAllowances?: number;
    changeReason?: string;
  }
) {
  const effectiveFrom = toDateOnly(input.effectiveFrom);
  const existing = await tx.hcmCompensationAssignment.findMany({
    where: { employmentId, companyId },
  });
  if (existing.length === 0) {
    throw new AppError(422, 'Employment has no compensation baseline');
  }

  let plan;
  try {
    plan = planTimelineChange(existing, effectiveFrom, (source) => ({
      basicSalary: input.basicSalary,
      fixedAllowances: input.fixedAllowances ?? source.fixedAllowances,
      changeReason: input.changeReason ?? source.changeReason,
    }));
  } catch (e) {
    mapTimelineError(e);
  }

  return applyCompensationTimelinePlan(tx, companyId, employmentId, plan, {
    basicSalary: input.basicSalary,
    fixedAllowances: input.fixedAllowances,
    changeReason: input.changeReason,
  });
}
