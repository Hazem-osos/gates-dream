import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  getTenantCached,
  invalidateTenantCache,
  tenantCacheKeys,
} from '../../../shared/cache/tenant-metadata-cache';

export interface CreateTaxPeriodInput {
  branchId?: string;
  fiscalYearId: string;
  periodNumber: number;
  periodName?: string;
  periodType?: 'MONTHLY' | 'QUARTERLY';
  sourceYearId?: string;
  startDate: Date;
  endDate: Date;
}

export class TaxPeriodService {
  async create(companyId: string, input: CreateTaxPeriodInput) {
    if (input.endDate < input.startDate) {
      throw new AppError(422, 'Tax period end date must be on or after start date');
    }
    const row = await prisma.taxPeriod.create({
      data: {
        companyId,
        branchId: input.branchId,
        fiscalYearId: input.fiscalYearId,
        periodNumber: input.periodNumber,
        periodName: input.periodName,
        periodType: input.periodType ?? 'MONTHLY',
        sourceYearId: input.sourceYearId,
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'OPEN',
      },
    });
    await invalidateTenantCache(`tenant:tax-periods:${companyId}:`);
    await invalidateTenantCache(tenantCacheKeys.taxRates(companyId));
    return row;
  }

  async list(companyId: string, fiscalYearId?: string) {
    return getTenantCached(tenantCacheKeys.taxPeriods(companyId, fiscalYearId), () =>
      prisma.taxPeriod.findMany({
        where: {
          companyId,
          ...(fiscalYearId ? { fiscalYearId } : {}),
        },
        orderBy: [{ fiscalYearId: 'desc' }, { periodNumber: 'asc' }],
      })
    );
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.taxPeriod.findFirst({ where: { id, companyId } });
    if (!row) throw new AppError(404, 'Tax period not found');
    return row;
  }

  async close(companyId: string, id: string) {
    const row = await this.getById(companyId, id);
    if (row.status === 'CLOSED') {
      throw new AppError(400, 'Tax period is already closed');
    }
    const updated = await prisma.taxPeriod.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    await invalidateTenantCache(`tenant:tax-periods:${companyId}:`);
    await invalidateTenantCache(tenantCacheKeys.taxRates(companyId));
    return updated;
  }

  async reopen(companyId: string, id: string) {
    const row = await this.getById(companyId, id);
    if (row.status === 'OPEN') {
      throw new AppError(400, 'Tax period is already open');
    }
    const updated = await prisma.taxPeriod.update({
      where: { id },
      data: { status: 'OPEN', closedAt: null },
    });
    await invalidateTenantCache(`tenant:tax-periods:${companyId}:`);
    await invalidateTenantCache(tenantCacheKeys.taxRates(companyId));
    return updated;
  }

  /** Block invoice/tax postings when document date falls in a CLOSED Dariba period. */
  async assertOpenForDocumentDate(companyId: string, documentDate: Date) {
    const closed = await prisma.taxPeriod.findFirst({
      where: {
        companyId,
        status: 'CLOSED',
        startDate: { lte: documentDate },
        endDate: { gte: documentDate },
      },
    });
    if (closed) {
      throw new AppError(
        403,
        `Tax period ${closed.periodNumber} is closed; posting is locked for this date`
      );
    }
  }
}

export const taxPeriodService = new TaxPeriodService();
