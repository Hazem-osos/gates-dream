import type { Prisma } from '@prisma/client';
import { AppError } from '../../../../shared/middleware/error-handler';
import { assertNoOverlap } from './employment-assignment.domain';
import { assertCompensationNoOverlap } from './compensation-assignment.domain';
import type { TimelineMutationPlan } from './hcm-timeline.domain';
import { toDateOnly } from '../../utils/hr-effective-date.util';

export async function applyAssignmentTimelinePlan(
  tx: Prisma.TransactionClient,
  companyId: string,
  employmentId: string,
  plan: TimelineMutationPlan<{
    id?: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    positionId?: string | null;
    branchId?: string | null;
    departmentId?: string | null;
    jobTitleId?: string | null;
    jobCadreId?: string | null;
    managerPositionId?: string | null;
    changeReason?: string | null;
    sourceProcedureId?: string | null;
  }>,
  defaults: {
    changeReason?: string;
    sourceProcedureId?: string;
    patch: {
      positionId?: string | null;
      branchId?: string | null;
      departmentId?: string | null;
      jobTitleId?: string | null;
      jobCadreId?: string | null;
      managerPositionId?: string | null;
    };
  }
) {
  for (const u of plan.updates) {
    await tx.hcmEmploymentAssignment.update({
      where: { id: u.id },
      data: { effectiveTo: u.effectiveTo ?? undefined },
    });
  }
  for (const ip of plan.inPlace ?? []) {
    await tx.hcmEmploymentAssignment.update({
      where: { id: ip.id },
      data: {
        ...defaults.patch,
        ...(ip.patch.effectiveTo !== undefined ? { effectiveTo: ip.patch.effectiveTo } : {}),
        changeReason: defaults.changeReason,
      },
    });
  }

  let lastCreated: { id: string } | null = null;
  for (const c of plan.creates) {
    const refreshed = await tx.hcmEmploymentAssignment.findMany({
      where: { employmentId, companyId },
    });
    assertNoOverlap(refreshed, c.effectiveFrom, c.effectiveTo);
    lastCreated = await tx.hcmEmploymentAssignment.create({
      data: {
        companyId,
        employmentId,
        positionId: c.positionId ?? defaults.patch.positionId ?? null,
        branchId: c.branchId ?? defaults.patch.branchId ?? null,
        departmentId: c.departmentId ?? defaults.patch.departmentId ?? null,
        jobTitleId: c.jobTitleId ?? defaults.patch.jobTitleId ?? null,
        jobCadreId: c.jobCadreId ?? defaults.patch.jobCadreId ?? null,
        managerPositionId: c.managerPositionId ?? defaults.patch.managerPositionId ?? null,
        effectiveFrom: toDateOnly(c.effectiveFrom),
        effectiveTo: c.effectiveTo ? toDateOnly(c.effectiveTo) : null,
        changeReason: c.changeReason ?? defaults.changeReason,
        sourceProcedureId: c.sourceProcedureId ?? defaults.sourceProcedureId,
      },
    });
  }

  const openRows = await tx.hcmEmploymentAssignment.count({
    where: { employmentId, companyId, effectiveTo: null },
  });
  if (openRows > 1) {
    throw new AppError(409, 'Multiple open employment assignments');
  }

  if (lastCreated) return lastCreated;
  const inPlaceId = plan.inPlace?.[0]?.id;
  if (inPlaceId) return { id: inPlaceId };
  throw new AppError(422, 'Timeline mutation produced no assignment row');
}

export async function applyCompensationTimelinePlan(
  tx: Prisma.TransactionClient,
  companyId: string,
  employmentId: string,
  plan: TimelineMutationPlan<{
    id?: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    basicSalary?: unknown;
    fixedAllowances?: unknown;
    changeReason?: string | null;
  }>,
  defaults: { basicSalary: number; fixedAllowances?: number; changeReason?: string }
) {
  for (const u of plan.updates) {
    await tx.hcmCompensationAssignment.update({
      where: { id: u.id },
      data: { effectiveTo: u.effectiveTo ?? undefined },
    });
  }
  for (const ip of plan.inPlace ?? []) {
    await tx.hcmCompensationAssignment.update({
      where: { id: ip.id },
      data: {
        basicSalary: defaults.basicSalary,
        fixedAllowances: defaults.fixedAllowances ?? 0,
        ...(ip.patch.effectiveTo !== undefined ? { effectiveTo: ip.patch.effectiveTo } : {}),
        changeReason: defaults.changeReason,
      },
    });
  }

  let lastCreated: { id: string } | null = null;
  for (const c of plan.creates) {
    const refreshed = await tx.hcmCompensationAssignment.findMany({
      where: { employmentId, companyId },
    });
    assertCompensationNoOverlap(refreshed, c.effectiveFrom, c.effectiveTo);
    lastCreated = await tx.hcmCompensationAssignment.create({
      data: {
        companyId,
        employmentId,
        effectiveFrom: toDateOnly(c.effectiveFrom),
        effectiveTo: c.effectiveTo ? toDateOnly(c.effectiveTo) : null,
        basicSalary: defaults.basicSalary,
        fixedAllowances: defaults.fixedAllowances ?? 0,
        changeReason: defaults.changeReason,
      },
    });
  }

  const openRows = await tx.hcmCompensationAssignment.count({
    where: { employmentId, companyId, effectiveTo: null },
  });
  if (openRows > 1) {
    throw new AppError(409, 'Multiple open compensation assignments');
  }

  if (lastCreated) return lastCreated;
  const inPlaceId = plan.inPlace?.[0]?.id;
  if (inPlaceId) return { id: inPlaceId };
  throw new AppError(422, 'Timeline mutation produced no compensation row');
}
