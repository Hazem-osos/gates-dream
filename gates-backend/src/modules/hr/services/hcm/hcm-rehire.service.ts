import { Prisma } from '@prisma/client';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { hcmEmploymentEpisodeService } from './hcm-employment-episode.service';
import { hcmCompatibilityService } from './hcm-compatibility.service';

export type RehireInput = {
  employeeId: string;
  effectiveDate: Date;
  departmentId?: string;
  branchId?: string;
  positionId?: string;
  jobTitleId?: string;
  basicSalary: number;
  fixedAllowances?: number;
  contract?: {
    contractStartDate: Date;
    contractEndDate?: Date;
    basicSalary?: number;
  };
};

export class HcmRehireService {
  async rehireEmployee(companyId: string, input: RehireInput) {
    const effectiveDate = toDateOnly(input.effectiveDate);

    const result = await prisma.$transaction(
      async (tx) => {
        const employee = await tx.employee.findFirst({
          where: { id: input.employeeId, companyId },
        });
        if (!employee) throw new AppError(404, 'Employee not found');

        await hcmEmploymentEpisodeService.lockEmployeeEpisodes(tx, companyId, input.employeeId);

        const prior = await tx.hcmEmployment.findFirst({
          where: { companyId, employeeId: input.employeeId },
          orderBy: [{ hireDate: 'desc' }, { episodeNumber: 'desc' }],
        });
        if (!prior) throw new AppError(422, 'No prior employment episode; use HIRE');
        if (prior.status !== 'TERMINATED') {
          throw new AppError(422, 'Latest employment episode is not terminated');
        }
        const open = await tx.hcmEmployment.count({
          where: {
            companyId,
            employeeId: input.employeeId,
            status: { in: ['ACTIVE', 'SUSPENDED'] },
          },
        });
        if (open > 0) throw new AppError(422, 'Employee already has an active employment episode');

        const agg = await tx.hcmEmployment.aggregate({
          where: { companyId, employeeId: input.employeeId },
          _max: { episodeNumber: true },
        });
        const episodeNumber = (agg._max.episodeNumber ?? 0) + 1;

        const employment = await tx.hcmEmployment.create({
          data: {
            companyId,
            employeeId: input.employeeId,
            episodeNumber,
            previousEmploymentId: prior.id,
            hireDate: effectiveDate,
            originalHireDate: prior.originalHireDate ?? prior.hireDate,
            status: 'ACTIVE',
          },
        });

        await tx.hcmEmploymentAssignment.create({
          data: {
            companyId,
            employmentId: employment.id,
            departmentId: input.departmentId ?? null,
            branchId: input.branchId ?? null,
            positionId: input.positionId ?? null,
            jobTitleId: input.jobTitleId ?? null,
            effectiveFrom: effectiveDate,
            effectiveTo: null,
            changeReason: 'REHIRE',
          },
        });

        await tx.hcmCompensationAssignment.create({
          data: {
            companyId,
            employmentId: employment.id,
            effectiveFrom: effectiveDate,
            effectiveTo: null,
            basicSalary: input.basicSalary,
            fixedAllowances: input.fixedAllowances ?? 0,
            changeReason: 'REHIRE',
          },
        });

        let contract = null;
        if (input.contract) {
          contract = await tx.employeeContract.create({
            data: {
              employeeId: input.employeeId,
              employmentId: employment.id,
              contractStartDate: toDateOnly(input.contract.contractStartDate),
              contractEndDate: input.contract.contractEndDate
                ? toDateOnly(input.contract.contractEndDate)
                : null,
              basicSalary: input.contract.basicSalary ?? input.basicSalary,
              contractStatus: 'ACTIVE',
              isActive: true,
            },
          });
        }

        await hcmEmploymentEpisodeService.assertSingleOpenEpisodeTx(
          tx,
          companyId,
          input.employeeId
        );

        return { employment, contract, priorEmploymentId: prior.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }
    );

    await hcmCompatibilityService.syncEmployeeProjection(companyId, result.employment.id);
    return result;
  }
}

export const hcmRehireService = new HcmRehireService();
