import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { logger } from '../../../../shared/logger';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { hcmCompatibilityService } from './hcm-compatibility.service';

const MIGRATION_BASELINE_NOTE = 'HCM Phase1 backfill baseline';

function inferUnitType(
  department: { managementId: string | null },
  parent: { managementId: string | null } | null
): string {
  if (!department.managementId) return 'MANAGEMENT';
  if (!parent || !parent.managementId) return 'DEPARTMENT';
  return 'SECTION';
}

export type BackfillResult = {
  employmentsCreated: number;
  assignmentsCreated: number;
  compensationsCreated: number;
  contractsLinked: number;
  departmentsTyped: number;
  skipped: number;
};

export class HcmBackfillService {
  /**
   * Idempotent per company: skips employees that already have HcmEmployment.
   */
  async backfillCompany(companyId: string): Promise<BackfillResult> {
    const result: BackfillResult = {
      employmentsCreated: 0,
      assignmentsCreated: 0,
      compensationsCreated: 0,
      contractsLinked: 0,
      departmentsTyped: 0,
      skipped: 0,
    };

    const departments = await prisma.department.findMany({ where: { companyId } });
    const deptById = new Map(departments.map((d) => [d.id, d]));
    for (const dept of departments) {
      if (dept.unitType && dept.unitType !== 'DEPARTMENT') continue;
      const parent = dept.managementId ? deptById.get(dept.managementId) : null;
      const unitType = inferUnitType(dept, parent ?? null);
      if (unitType !== dept.unitType) {
        await prisma.department.update({
          where: { id: dept.id },
          data: { unitType },
        });
        result.departmentsTyped++;
      }
    }

    const employees = await prisma.employee.findMany({
      where: { companyId, isActive: true },
      include: {
        contracts: { where: { isActive: true }, orderBy: { contractStartDate: 'desc' }, take: 1 },
      },
    });

    for (const emp of employees) {
      const existing = await prisma.hcmEmployment.findFirst({
        where: { companyId, employeeId: emp.id },
      });
      if (existing) {
        result.skipped++;
        continue;
      }

      const contract = emp.contracts[0];
      const hireDate = toDateOnly(emp.joinDate ?? contract?.contractStartDate ?? emp.createdAt);

      await prisma.$transaction(async (tx) => {
        const employment = await tx.hcmEmployment.create({
          data: {
            companyId,
            employeeId: emp.id,
            hireDate,
            originalHireDate: hireDate,
            status: emp.isActive ? 'ACTIVE' : 'TERMINATED',
            employmentNumber: emp.serial ?? emp.employeeId,
          },
        });
        result.employmentsCreated++;

        const departmentId = emp.departmentId ?? contract?.departmentId ?? null;
        const sectionId = contract?.sectionId ?? null;
        const orgUnitId = sectionId ?? departmentId;

        await tx.hcmEmploymentAssignment.create({
          data: {
            companyId,
            employmentId: employment.id,
            departmentId: orgUnitId,
            jobTitleId: emp.jobTitleId ?? contract?.jobTitleId ?? null,
            jobCadreId: contract?.jobCadreId ?? null,
            branchId: contract?.workBranchId ?? null,
            effectiveFrom: hireDate,
            effectiveTo: null,
            changeReason: MIGRATION_BASELINE_NOTE,
          },
        });
        result.assignmentsCreated++;

        const basic = Number(emp.basicSalary ?? contract?.basicSalary ?? 0);
        const fixed = Number(emp.fixedAllowances ?? 0);
        if (basic > 0 || fixed > 0) {
          await tx.hcmCompensationAssignment.create({
            data: {
              companyId,
              employmentId: employment.id,
              effectiveFrom: hireDate,
              effectiveTo: null,
              basicSalary: new Decimal(basic),
              fixedAllowances: new Decimal(fixed),
              changeReason: MIGRATION_BASELINE_NOTE,
            },
          });
          result.compensationsCreated++;
        }

        if (contract) {
          await tx.employeeContract.update({
            where: { id: contract.id },
            data: { employmentId: employment.id },
          });
          result.contractsLinked++;
        }
      });

      const employment = await prisma.hcmEmployment.findFirst({
        where: { companyId, employeeId: emp.id },
      });
      if (employment) {
        await hcmCompatibilityService.syncEmployeeProjection(companyId, employment.id);
      }
    }

    logger.info({ companyId, result }, 'HCM Phase 1 backfill completed');
    return result;
  }
}

export const hcmBackfillService = new HcmBackfillService();
