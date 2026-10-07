import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { lockHcmEmploymentRow } from './hcm-employment-lock.util';
import { hcmCompatibilityService } from './hcm-compatibility.service';
import { hcmEmploymentEpisodeService } from './hcm-employment-episode.service';

export type HireInput = {
  arabicName: string;
  englishName?: string;
  identityNumber: string;
  joinDate: Date;
  departmentId?: string;
  branchId?: string;
  positionId?: string;
  jobTitleId?: string;
  basicSalary: number;
  fixedAllowances?: number;
};

export class HcmHireService {
  /** Atomic: Employee + HcmEmployment + initial assignment + compensation. */
  async hireEmployee(companyId: string, input: HireInput) {
    const hireDate = toDateOnly(input.joinDate);
    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          companyId,
          arabicName: input.arabicName,
          englishName: input.englishName,
          identityNumber: input.identityNumber,
          joinDate: hireDate,
          departmentId: input.departmentId,
          basicSalary: input.basicSalary,
          isActive: true,
        },
      });

      await hcmEmploymentEpisodeService.assertNoOpenEpisode(companyId, employee.id);

      const employment = await tx.hcmEmployment.create({
        data: {
          companyId,
          employeeId: employee.id,
          episodeNumber: 1,
          hireDate,
          status: 'ACTIVE',
        },
      });

      await lockHcmEmploymentRow(tx, employment.id);

      await tx.hcmEmploymentAssignment.create({
        data: {
          companyId,
          employmentId: employment.id,
          departmentId: input.departmentId ?? null,
          branchId: input.branchId ?? null,
          positionId: input.positionId ?? null,
          jobTitleId: input.jobTitleId ?? null,
          effectiveFrom: hireDate,
          effectiveTo: null,
          changeReason: 'HIRE',
        },
      });

      await tx.hcmCompensationAssignment.create({
        data: {
          companyId,
          employmentId: employment.id,
          effectiveFrom: hireDate,
          effectiveTo: null,
          basicSalary: input.basicSalary,
          fixedAllowances: input.fixedAllowances ?? 0,
          changeReason: 'HIRE',
        },
      });

      return { employee, employment };
    });

    await hcmCompatibilityService.syncEmployeeProjection(companyId, result.employment.id);
    return result;
  }
}

export const hcmHireService = new HcmHireService();
