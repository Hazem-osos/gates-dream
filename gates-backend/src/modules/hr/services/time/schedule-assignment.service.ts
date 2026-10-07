import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly } from '../../utils/hr-effective-date.util';

function rangesOverlap(
  aFrom: Date,
  aTo: Date | null,
  bFrom: Date,
  bTo: Date | null
): boolean {
  const aEnd = aTo ? toDateOnly(aTo).getTime() : Number.MAX_SAFE_INTEGER;
  const bEnd = bTo ? toDateOnly(bTo).getTime() : Number.MAX_SAFE_INTEGER;
  const aStart = toDateOnly(aFrom).getTime();
  const bStart = toDateOnly(bFrom).getTime();
  return aStart <= bEnd && bStart <= aEnd;
}

export class ScheduleAssignmentService {
  async list(companyId: string, employmentId?: string) {
    return prisma.hcmEmployeeScheduleAssignment.findMany({
      where: { companyId, ...(employmentId ? { employmentId } : {}) },
      include: { schedule: true },
      orderBy: [{ employmentId: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  async create(
    companyId: string,
    input: {
      employmentId: string;
      scheduleId: string;
      effectiveFrom: Date;
      effectiveTo?: Date | null;
    }
  ) {
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: input.employmentId, companyId },
    });
    if (!employment) throw new AppError(404, 'Employment not found');
    const schedule = await prisma.hcmWorkSchedule.findFirst({
      where: { id: input.scheduleId, companyId },
    });
    if (!schedule) throw new AppError(404, 'Schedule not found');

    const existing = await prisma.hcmEmployeeScheduleAssignment.findMany({
      where: { companyId, employmentId: input.employmentId },
    });
    for (const row of existing) {
      if (
        rangesOverlap(row.effectiveFrom, row.effectiveTo, input.effectiveFrom, input.effectiveTo ?? null)
      ) {
        throw new AppError(422, 'Schedule assignment overlaps an existing assignment');
      }
    }

    return prisma.hcmEmployeeScheduleAssignment.create({
      data: {
        companyId,
        employmentId: input.employmentId,
        scheduleId: input.scheduleId,
        effectiveFrom: toDateOnly(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? toDateOnly(input.effectiveTo) : null,
      },
    });
  }
}

export const scheduleAssignmentService = new ScheduleAssignmentService();
