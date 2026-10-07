import { Prisma } from '@prisma/client';
import prisma from '../../../../shared/database/prisma';
import { lockHcmEmploymentRow } from './hcm-employment-lock.util';
import { AppError } from '../../../../shared/middleware/error-handler';
import { pickAssignmentAtDate, pickCurrentAssignment } from './employment-assignment.domain';
import { pickCurrentCompensation } from './compensation-assignment.domain';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { hcmCompatibilityService } from './hcm-compatibility.service';
import { transitionAssignmentInTx } from './hcm-assignment-timeline.service';
import { transitionCompensationInTx } from './hcm-compensation-timeline.service';

export type AssignmentTransitionInput = {
  positionId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  jobTitleId?: string | null;
  jobCadreId?: string | null;
  managerPositionId?: string | null;
  effectiveFrom: Date;
  changeReason?: string;
  sourceProcedureId?: string;
};

export type CompensationTransitionInput = {
  effectiveFrom: Date;
  basicSalary: number;
  fixedAllowances?: number;
  currencyCode?: string;
  changeReason?: string;
  sourceProcedureId?: string;
};

export class HcmTransitionService {
  async transitionAssignment(
    companyId: string,
    employmentId: string,
    input: AssignmentTransitionInput
  ) {
    const effectiveFrom = toDateOnly(input.effectiveFrom);

    return prisma
      .$transaction(
        async (tx) => {
          const employment = await tx.hcmEmployment.findFirst({
            where: { id: employmentId, companyId },
          });
          if (!employment) throw new AppError(404, 'Employment not found');

          await lockHcmEmploymentRow(tx, employmentId);
          return transitionAssignmentInTx(tx, companyId, employmentId, {
            ...input,
            effectiveFrom,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }
      )
      .then(async (created) => {
        await hcmCompatibilityService.syncEmployeeProjection(companyId, employmentId);
        return created;
      });
  }

  async transitionCompensation(
    companyId: string,
    employmentId: string,
    input: CompensationTransitionInput
  ) {
    const effectiveFrom = toDateOnly(input.effectiveFrom);

    return prisma
      .$transaction(
        async (tx) => {
          const employment = await tx.hcmEmployment.findFirst({
            where: { id: employmentId, companyId },
          });
          if (!employment) throw new AppError(404, 'Employment not found');

          await lockHcmEmploymentRow(tx, employmentId);
          return transitionCompensationInTx(tx, companyId, employmentId, {
            effectiveFrom,
            basicSalary: input.basicSalary,
            fixedAllowances: input.fixedAllowances,
            changeReason: input.changeReason,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }
      )
      .then(async (created) => {
        await hcmCompatibilityService.syncEmployeeProjection(companyId, employmentId);
        return created;
      });
  }

  async getAssignmentAtDate(companyId: string, employmentId: string, at: Date) {
    const rows = await prisma.hcmEmploymentAssignment.findMany({
      where: { companyId, employmentId },
    });
    return pickAssignmentAtDate(rows, at);
  }

  async getCurrentAssignment(companyId: string, employmentId: string) {
    const rows = await prisma.hcmEmploymentAssignment.findMany({
      where: { companyId, employmentId },
    });
    return pickCurrentAssignment(rows);
  }
}

export const hcmTransitionService = new HcmTransitionService();
