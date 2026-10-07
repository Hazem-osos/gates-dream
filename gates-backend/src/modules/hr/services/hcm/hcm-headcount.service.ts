import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly, isDateInEffectiveRange } from '../../utils/hr-effective-date.util';

export type HeadcountState = 'VACANT' | 'PARTIALLY_FILLED' | 'FILLED';

export class HcmHeadcountService {
  async countOccupantsAt(
    companyId: string,
    positionId: string,
    day: Date,
    excludeEmploymentId?: string
  ): Promise<number> {
    const d = toDateOnly(day);
    const assignments = await prisma.hcmEmploymentAssignment.findMany({
      where: { companyId, positionId },
      include: { employment: { select: { id: true, status: true } } },
    });

    return assignments.filter((a) => {
      if (excludeEmploymentId && a.employmentId === excludeEmploymentId) return false;
      if (a.employment.status === 'TERMINATED') return false;
      return isDateInEffectiveRange(d, a.effectiveFrom, a.effectiveTo);
    }).length;
  }

  async assertPositionCapacity(
    companyId: string,
    positionId: string,
    effectiveFrom: Date,
    excludeEmploymentId?: string
  ): Promise<void> {
    const position = await prisma.hcmPosition.findFirst({
      where: { id: positionId, companyId, isActive: true },
    });
    if (!position) throw new AppError(422, 'Position not found');
    const limit = position.headcountLimit;
    if (!limit || limit <= 0) return;

    const count = await this.countOccupantsAt(
      companyId,
      positionId,
      effectiveFrom,
      excludeEmploymentId
    );
    if (count >= limit) {
      throw new AppError(422, `Position headcount limit (${limit}) would be exceeded on ${toDateOnly(effectiveFrom).toISOString().slice(0, 10)}`);
    }
  }

  async deriveState(
    companyId: string,
    positionId: string,
    asOf: Date = toDateOnly(new Date())
  ): Promise<HeadcountState> {
    const position = await prisma.hcmPosition.findFirst({ where: { id: positionId, companyId } });
    if (!position) return 'VACANT';
    const limit = position.headcountLimit ?? 1;
    const count = await this.countOccupantsAt(companyId, positionId, asOf);
    if (count <= 0) return 'VACANT';
    if (count >= limit) return 'FILLED';
    return 'PARTIALLY_FILLED';
  }
}

export const hcmHeadcountService = new HcmHeadcountService();
