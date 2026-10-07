import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly } from '../../utils/hr-effective-date.util';

export class LeaveEnrollmentService {
  async resolvePolicyAt(companyId: string, employmentId: string, date: Date) {
    const at = toDateOnly(date);
    const enrollment = await prisma.hcmLeaveEnrollment.findFirst({
      where: {
        companyId,
        employmentId,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      include: { policy: true },
    });
    return enrollment;
  }

  async assignEnrollment(
    companyId: string,
    input: {
      employmentId: string;
      policyId: string;
      effectiveFrom: Date;
      effectiveTo?: Date | null;
    }
  ) {
    const from = toDateOnly(input.effectiveFrom);
    const to = input.effectiveTo ? toDateOnly(input.effectiveTo) : null;
    const overlap = await prisma.hcmLeaveEnrollment.findFirst({
      where: {
        companyId,
        employmentId: input.employmentId,
        effectiveFrom: { lte: to ?? new Date('2099-12-31') },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
    });
    if (overlap) throw new AppError(409, 'Enrollment overlaps existing assignment');
    return prisma.hcmLeaveEnrollment.create({
      data: {
        companyId,
        employmentId: input.employmentId,
        policyId: input.policyId,
        effectiveFrom: from,
        effectiveTo: to,
      },
    });
  }
}

export const leaveEnrollmentService = new LeaveEnrollmentService();
