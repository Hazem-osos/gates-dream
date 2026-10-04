import type { ProjectCostCategory } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { money, sumMoney } from '../utils/money-decimal';
import { ContractingProjectNotFoundError } from '../cost-control/errors/cost-control-domain.errors';
import { projectCostAllocationService } from './project-cost-allocation.service';

const CATEGORIES: ProjectCostCategory[] = [
  'MATERIAL',
  'LABOR',
  'SUBCONTRACTOR',
  'EQUIPMENT',
  'DIRECT_EXPENSE',
  'PURCHASE',
  'OVERHEAD',
  'OTHER',
];

export type ProjectCostCategoryTotals = Record<ProjectCostCategory, number> & {
  totalActualCost: number;
  unallocated: number;
};

function emptyTotals(): ProjectCostCategoryTotals {
  const base = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<ProjectCostCategory, number>;
  return { ...base, totalActualCost: 0, unallocated: 0 };
}

export class ProjectCostQueryService {
  async getProjectSummary(companyId: string, projectId: string) {
    const project = await prisma.contractingProject.findFirst({ where: { id: projectId, companyId } });
    if (!project) throw new ContractingProjectNotFoundError(companyId, projectId);

    const rows = await prisma.projectCostAllocation.findMany({
      where: { companyId, projectId, status: 'ACTIVE' },
    });

    const totals = emptyTotals();
    for (const row of rows) {
      const amt = Number(row.amountBase);
      totals[row.costCategory] = money(totals[row.costCategory] + amt).toNumber();
      totals.totalActualCost = money(totals.totalActualCost + amt).toNumber();
      if (!row.projectBOQItemId) {
        totals.unallocated = money(totals.unallocated + amt).toNumber();
      }
    }
    return { projectId, companyId, totals };
  }

  async getBoqBreakdown(companyId: string, projectId: string) {
    const project = await prisma.contractingProject.findFirst({ where: { id: projectId, companyId } });
    if (!project) throw new ContractingProjectNotFoundError(companyId, projectId);

    const [boqItems, rows] = await Promise.all([
      prisma.projectBOQItem.findMany({
        where: { companyId, projectId },
        orderBy: { itemCode: 'asc' },
      }),
      prisma.projectCostAllocation.findMany({
        where: { companyId, projectId, status: 'ACTIVE', projectBOQItemId: { not: null } },
      }),
    ]);

    const byBoq = new Map<string, ProjectCostCategoryTotals>();
    for (const item of boqItems) {
      byBoq.set(item.id, emptyTotals());
    }
    for (const row of rows) {
      if (!row.projectBOQItemId) continue;
      const bucket = byBoq.get(row.projectBOQItemId) ?? emptyTotals();
      const amt = Number(row.amountBase);
      bucket[row.costCategory] = money(bucket[row.costCategory] + amt).toNumber();
      bucket.totalActualCost = money(bucket.totalActualCost + amt).toNumber();
      byBoq.set(row.projectBOQItemId, bucket);
    }

    return {
      projectId,
      items: boqItems.map((item) => ({
        projectBOQItemId: item.id,
        itemCode: item.itemCode,
        descriptionAr: item.descriptionAr,
        origin: item.origin,
        totals: byBoq.get(item.id) ?? emptyTotals(),
      })),
    };
  }

  async listSources(
    companyId: string,
    projectId: string,
    filters?: { projectBOQItemId?: string; costCategory?: ProjectCostCategory }
  ) {
    const rows = await prisma.projectCostAllocation.findMany({
      where: {
        companyId,
        projectId,
        status: 'ACTIVE',
        ...(filters?.projectBOQItemId ? { projectBOQItemId: filters.projectBOQItemId } : {}),
        ...(filters?.costCategory ? { costCategory: filters.costCategory } : {}),
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      transactionDate: row.transactionDate,
      costCategory: row.costCategory,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      sourceLineId: row.sourceLineId,
      projectBOQItemId: row.projectBOQItemId,
      quantity: row.quantity != null ? Number(row.quantity) : null,
      amountBase: Number(row.amountBase),
      description: row.description,
      status: row.status,
    }));
  }
}

export const projectCostQueryService = new ProjectCostQueryService();

export class ProjectCostSplitService {
  async applyManualSplit(
    companyId: string,
    input: {
      projectId: string;
      sourceType: 'MANUAL_COST_SPLIT';
      sourceId: string;
      eligibleAmount: number;
      transactionDate: Date;
      description?: string;
      splits: Array<{ projectBOQItemId: string; amountBase: number; costCategory?: ProjectCostCategory }>;
    }
  ) {
    const splitSum = sumMoney(input.splits.map((s) => money(s.amountBase)));
    if (splitSum.gt(money(input.eligibleAmount))) {
      throw new AppError(422, 'مجموع التوزيع يتجاوز تكلفة المصدر المؤهلة');
    }
    return prisma.$transaction(async (tx) => {
      let slot = 0;
      for (const split of input.splits) {
        await projectCostAllocationService.upsertActive(tx, {
          companyId,
          projectId: input.projectId,
          projectBOQItemId: split.projectBOQItemId,
          costCategory: split.costCategory ?? 'OTHER',
          sourceType: 'MANUAL_COST_SPLIT',
          sourceId: input.sourceId,
          slot: String(slot++),
          amountBase: Number(split.amountBase),
          transactionDate: input.transactionDate,
          description: input.description,
        });
      }
    });
  }
}

export const projectCostSplitService = new ProjectCostSplitService();
