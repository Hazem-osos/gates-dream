import prisma from '../../../../shared/database/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  pickAssignmentAtDate,
  pickCurrentAssignment,
} from './employment-assignment.domain';
import {
  pickCompensationAtDate,
  pickCurrentCompensation,
} from './compensation-assignment.domain';
import { toDateOnly } from '../../utils/hr-effective-date.util';

/**
 * Projects canonical HCM state onto legacy Employee fields (one-way).
 * Payroll engine continues to read Employee.* until Phase 5.
 */
export class HcmCompatibilityService {
  /**
   * Projects assignment/compensation effective on `asOf` (default: today UTC) onto Employee.
   * On-read reconciliation: future-dated rows do not affect Employee until their effective date.
   */
  async syncEmployeeProjection(
    companyId: string,
    employmentId: string,
    asOf: Date = toDateOnly(new Date())
  ): Promise<void> {
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: employmentId, companyId },
      include: { employee: true },
    });
    if (!employment) return;

    const [assignments, compensations] = await Promise.all([
      prisma.hcmEmploymentAssignment.findMany({ where: { employmentId } }),
      prisma.hcmCompensationAssignment.findMany({ where: { employmentId } }),
    ]);

    const currentAssignment =
      pickAssignmentAtDate(assignments, asOf) ?? pickCurrentAssignment(assignments);
    const currentCompensation =
      pickCompensationAtDate(compensations, asOf) ?? pickCurrentCompensation(compensations);

    const data: Record<string, unknown> = {};
    if (currentAssignment) {
      if (currentAssignment.departmentId) data.departmentId = currentAssignment.departmentId;
      if (currentAssignment.jobTitleId) data.jobTitleId = currentAssignment.jobTitleId;
      if (currentAssignment.positionId) {
        const pos = await prisma.hcmPosition.findFirst({
          where: { id: currentAssignment.positionId, companyId },
          select: { costCenterId: true },
        });
        if (pos?.costCenterId) data.costCenterId = pos.costCenterId;
      }
    }
    if (currentCompensation) {
      data.basicSalary = new Decimal(currentCompensation.basicSalary);
      data.fixedAllowances = new Decimal(currentCompensation.fixedAllowances);
    }

    if (Object.keys(data).length === 0) return;

    await prisma.employee.update({
      where: { id: employment.employeeId },
      data,
    });
  }
}

export const hcmCompatibilityService = new HcmCompatibilityService();
