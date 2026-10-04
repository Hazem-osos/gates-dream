import type { Prisma, ProjectCostAllocationStatus, ProjectCostCategory, ProjectCostSourceType } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { classifyAccount } from '../../accounting/services/financial-report.util';
import { money, moneyZero } from '../utils/money-decimal';
import { buildProjectCostAllocationKey } from './project-cost-allocation.util';

type Db = Prisma.TransactionClient | typeof prisma;

export type UpsertProjectCostAllocationInput = {
  companyId: string;
  projectId: string;
  projectBOQItemId?: string | null;
  costCategory: ProjectCostCategory;
  sourceType: ProjectCostSourceType;
  sourceId: string;
  sourceLineId?: string | null;
  slot?: string;
  quantity?: number | null;
  amountBase: number;
  sourceCurrencyCode?: string | null;
  exchangeRate?: number | null;
  transactionDate: Date;
  status?: ProjectCostAllocationStatus;
  description?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export class ProjectCostAllocationService {
  async upsertActive(db: Db, input: UpsertProjectCostAllocationInput) {
    const allocationKey = buildProjectCostAllocationKey({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceLineId: input.sourceLineId,
      projectBOQItemId: input.projectBOQItemId,
      slot: input.slot,
    });
    const amountBase = money(input.amountBase);
    const data = {
      companyId: input.companyId,
      projectId: input.projectId,
      projectBOQItemId: input.projectBOQItemId ?? null,
      costCategory: input.costCategory,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceLineId: input.sourceLineId ?? null,
      allocationKey,
      quantity: input.quantity != null ? money(input.quantity) : null,
      amountBase,
      sourceCurrencyCode: input.sourceCurrencyCode ?? null,
      exchangeRate: input.exchangeRate != null ? money(input.exchangeRate) : null,
      transactionDate: input.transactionDate,
      status: input.status ?? ('ACTIVE' as const),
      description: input.description ?? null,
      metadata: input.metadata,
    };
    return db.projectCostAllocation.upsert({
      where: { companyId_allocationKey: { companyId: input.companyId, allocationKey } },
      create: data,
      update: data,
    });
  }

  async reverseBySourceInTx(
    db: Db,
    companyId: string,
    sourceType: ProjectCostSourceType,
    sourceId: string
  ) {
    await db.projectCostAllocation.updateMany({
      where: { companyId, sourceType, sourceId, status: 'ACTIVE' },
      data: { status: 'REVERSED' },
    });
  }

  async resolveProjectIdByCostCenterInTx(db: Db, companyId: string, costCenterId: string | null | undefined) {
    if (!costCenterId) return null;
    const project = await db.contractingProject.findFirst({
      where: { companyId, costCenterId },
      select: { id: true },
    });
    return project?.id ?? null;
  }

  async resolveOwnerBoqBySubItemCodeInTx(
    db: Db,
    companyId: string,
    projectId: string,
    itemCode: string
  ) {
    return db.projectBOQItem.findFirst({
      where: { companyId, projectId, itemCode },
      select: { id: true },
    });
  }

  isExpenseAccount(code: string, accountType: string) {
    const cls = classifyAccount(code, accountType);
    return cls === 'EXPENSE' || cls === 'COGS';
  }

  sumActiveAmount(rows: Array<{ amountBase: Prisma.Decimal; status: string }>) {
    let total = moneyZero();
    for (const row of rows) {
      if (row.status !== 'ACTIVE') continue;
      total = money(total.plus(row.amountBase));
    }
    return total;
  }
}

export const projectCostAllocationService = new ProjectCostAllocationService();
