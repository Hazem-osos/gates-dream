import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly } from '../../utils/hr-effective-date.util';

async function assertNoReportingCycle(
  companyId: string,
  positionId: string | null,
  reportsToPositionId: string | null | undefined
) {
  if (!reportsToPositionId) return;
  if (positionId && reportsToPositionId === positionId) {
    throw new AppError(422, 'Position cannot report to itself');
  }
  const seen = new Set<string>();
  let cursor: string | null = reportsToPositionId;
  while (cursor) {
    if (positionId && cursor === positionId) {
      throw new AppError(422, 'Reporting hierarchy cycle detected');
    }
    if (seen.has(cursor)) {
      throw new AppError(422, 'Reporting hierarchy cycle detected');
    }
    seen.add(cursor);
    const parent = await prisma.hcmPosition.findFirst({
      where: { id: cursor, companyId },
      select: { reportsToPositionId: true },
    });
    if (!parent) throw new AppError(422, 'Invalid reports-to position');
    cursor = parent.reportsToPositionId;
  }
}

async function assertRefsSameCompany(
  companyId: string,
  refs: {
    departmentId?: string | null;
    branchId?: string | null;
    jobTitleId?: string | null;
    jobCadreId?: string | null;
    costCenterId?: string | null;
  }
) {
  if (refs.departmentId) {
    const row = await prisma.department.findFirst({ where: { id: refs.departmentId, companyId } });
    if (!row) throw new AppError(422, 'Referenced org entity not found in company');
  }
  if (refs.branchId) {
    const row = await prisma.branch.findFirst({ where: { id: refs.branchId, companyId } });
    if (!row) throw new AppError(422, 'Referenced org entity not found in company');
  }
  if (refs.jobTitleId) {
    const row = await prisma.jobTitle.findFirst({ where: { id: refs.jobTitleId, companyId } });
    if (!row) throw new AppError(422, 'Referenced org entity not found in company');
  }
  if (refs.jobCadreId) {
    const row = await prisma.jobCadre.findFirst({ where: { id: refs.jobCadreId, companyId } });
    if (!row) throw new AppError(422, 'Referenced org entity not found in company');
  }
  if (refs.costCenterId) {
    const row = await prisma.costCenter.findFirst({ where: { id: refs.costCenterId, companyId } });
    if (!row) throw new AppError(422, 'Referenced org entity not found in company');
  }
}

export class HcmPositionService {
  async create(
    companyId: string,
    data: {
      code: string;
      arabicName: string;
      englishName?: string;
      jobTitleId?: string;
      departmentId?: string;
      branchId?: string;
      jobCadreId?: string;
      costCenterId?: string;
      reportsToPositionId?: string;
      headcountLimit?: number;
      effectiveFrom: Date;
      effectiveTo?: Date;
    }
  ) {
    await assertRefsSameCompany(companyId, data);
    await assertNoReportingCycle(companyId, null, data.reportsToPositionId);

    const dup = await prisma.hcmPosition.findFirst({ where: { companyId, code: data.code } });
    if (dup) throw new AppError(409, 'Position code already exists');

    return prisma.hcmPosition.create({
      data: {
        companyId,
        code: data.code,
        arabicName: data.arabicName,
        englishName: data.englishName,
        jobTitleId: data.jobTitleId,
        departmentId: data.departmentId,
        branchId: data.branchId,
        jobCadreId: data.jobCadreId,
        costCenterId: data.costCenterId,
        reportsToPositionId: data.reportsToPositionId,
        headcountLimit: data.headcountLimit,
        effectiveFrom: toDateOnly(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? toDateOnly(data.effectiveTo) : null,
      },
    });
  }

  async list(companyId: string, options?: { isActive?: boolean; departmentId?: string }) {
    return prisma.hcmPosition.findMany({
      where: {
        companyId,
        isActive: options?.isActive ?? true,
        departmentId: options?.departmentId,
      },
      orderBy: { code: 'asc' },
      include: {
        jobTitle: { select: { id: true, arabicName: true } },
        department: { select: { id: true, arabicName: true, unitType: true } },
        reportsTo: { select: { id: true, code: true, arabicName: true } },
      },
    });
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.hcmPosition.findFirst({
      where: { id, companyId },
      include: {
        jobTitle: true,
        department: true,
        branch: true,
        jobCadre: true,
        reportsTo: true,
        assignments: {
          where: { effectiveTo: null },
          include: { employment: { include: { employee: { select: { id: true, arabicName: true } } } } },
        },
      },
    });
    if (!row) throw new AppError(404, 'Position not found');
    return row;
  }

  async updateReportsTo(companyId: string, id: string, reportsToPositionId: string | null) {
    await assertNoReportingCycle(companyId, id, reportsToPositionId);
    const existing = await prisma.hcmPosition.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError(404, 'Position not found');
    return prisma.hcmPosition.update({
      where: { id },
      data: { reportsToPositionId },
    });
  }
}

export const hcmPositionService = new HcmPositionService();
