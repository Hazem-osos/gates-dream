import type { BOQCostElementType, Prisma } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { classifyAccount } from '../../../accounting/services/financial-report.util';
import { money, moneyZero, rate, toDecimal } from '../../utils/money-decimal';
import { ContractingProjectNotFoundError } from '../errors/cost-control-domain.errors';
import type {
  BoqBudgetVsActualRow,
  EvmActualCostBreakdown,
  EvmAsOfOptions,
  ProjectBudgetVsActual,
  ProjectEvmDashboard,
} from '../types/evm.types';

const ELEMENT_TYPES: BOQCostElementType[] = [
  'MATERIAL',
  'LABOR',
  'EQUIPMENT',
  'SUBCONTRACTOR',
  'SITE_EXPENSE',
];

const POSTED_SUBCONTRACT_INVOICE_STATUSES = ['FINANCE_POSTED', 'PAID'] as const;

type Db = Prisma.TransactionClient | typeof prisma;

type OwnerBoqRow = Prisma.ProjectBOQItemGetPayload<{
  include: { rateAnalysisItems: true };
}>;

export class ProjectCostControlService {
  async getProjectEvmDashboard(
    companyId: string,
    projectId: string,
    options: EvmAsOfOptions = {}
  ): Promise<ProjectEvmDashboard> {
    const asOfDate = options.asOfDate ?? new Date();
    const ctx = await this.loadProjectContext(companyId, projectId, asOfDate);

    const plannedValue = sumItem(ctx.boqItems, (item) =>
      money(this.plannedQtyToDate(item, ctx).mul(money(item.directCostEstimated)))
    );
    const earnedValue = sumItem(ctx.boqItems, (item) =>
      money(money(item.cumulativeExecutedQty).mul(money(item.directCostEstimated)))
    );
    const actuals = ctx.actuals;
    const actualCost = actuals.actualCost;
    const budgetAtCompletion = sumItem(ctx.boqItems, (item) =>
      money(money(item.contractQuantity).mul(money(item.directCostEstimated)))
    );

    const costVariance = money(earnedValue.minus(actualCost));
    const scheduleVariance = money(earnedValue.minus(plannedValue));
    const cpi = actualCost.gt(0) ? rate(earnedValue.div(actualCost)) : null;
    const spi = plannedValue.gt(0) ? rate(earnedValue.div(plannedValue)) : null;
    const estimateAtCompletion =
      cpi && cpi.gt(0) ? money(budgetAtCompletion.div(cpi)) : null;
    const varianceAtCompletion = estimateAtCompletion
      ? money(budgetAtCompletion.minus(estimateAtCompletion))
      : null;
    const estimateToComplete = estimateAtCompletion
      ? money(estimateAtCompletion.minus(actualCost))
      : null;

    return {
      companyId,
      projectId: ctx.project.id,
      projectCode: ctx.project.projectCode,
      projectName: ctx.project.projectName,
      asOfDate,
      schedule: {
        startDate: ctx.project.startDate,
        endDate: ctx.project.endDate,
        elapsedFraction: ctx.elapsedFraction,
      },
      plannedValue,
      earnedValue,
      actualCost,
      costVariance,
      scheduleVariance,
      cpi,
      spi,
      budgetAtCompletion,
      estimateAtCompletion,
      varianceAtCompletion,
      estimateToComplete,
      actuals,
      flags: {
        underBudget: costVariance.gte(0),
        aheadOfSchedule: scheduleVariance.gte(0),
        cpiHealthy: cpi == null ? earnedValue.gte(0) && actualCost.eq(0) : cpi.gte(1),
        spiOnTrack: spi == null ? earnedValue.gte(0) && plannedValue.eq(0) : spi.gte(1),
      },
    };
  }

  async getBudgetVsActual(
    companyId: string,
    projectId: string,
    options: EvmAsOfOptions = {}
  ): Promise<ProjectBudgetVsActual> {
    const asOfDate = options.asOfDate ?? new Date();
    const ctx = await this.loadProjectContext(companyId, projectId, asOfDate);

    const earnedValue = sumItem(ctx.boqItems, (item) =>
      money(money(item.cumulativeExecutedQty).mul(money(item.directCostEstimated)))
    );
    const totalPlannedBudget = sumItem(ctx.boqItems, (item) =>
      money(money(item.contractQuantity).mul(money(item.directCostEstimated)))
    );
    const totalPlannedMaterials = sumItem(ctx.boqItems, (item) =>
      money(this.elementUnitCost(item, 'MATERIAL').mul(money(item.cumulativeExecutedQty)))
    );

    const items: BoqBudgetVsActualRow[] = ctx.boqItems.map((item) => {
      const plannedQuantity = money(item.contractQuantity);
      const plannedQtyToDate = this.plannedQtyToDate(item, ctx);
      const executedQuantity = money(item.cumulativeExecutedQty);
      const plannedUnitRate = money(item.directCostEstimated);
      const plannedBudgetCost = money(plannedQuantity.mul(plannedUnitRate));
      const earnedBudgetCost = money(executedQuantity.mul(plannedUnitRate));
      const evWeight = earnedValue.gt(0)
        ? earnedBudgetCost.div(earnedValue)
        : totalPlannedBudget.gt(0)
          ? plannedBudgetCost.div(totalPlannedBudget)
          : toDecimal(0);
      const allocatedActualCost = money(ctx.actuals.actualCost.mul(evWeight));
      const actualUnitCost = executedQuantity.gt(0)
        ? money(allocatedActualCost.div(executedQuantity))
        : null;
      const plannedMaterialUnit = this.elementUnitCost(item, 'MATERIAL');
      const plannedConsumed = money(plannedMaterialUnit.mul(executedQuantity));
      const materialWeight = totalPlannedMaterials.gt(0)
        ? plannedConsumed.div(totalPlannedMaterials)
        : evWeight;
      const actualConsumed = money(ctx.actuals.materialCosts.mul(materialWeight));

      return {
        projectBOQItemId: item.id,
        itemCode: item.itemCode,
        descriptionAr: item.descriptionAr,
        unit: item.unit,
        status: item.status,
        plannedQuantity,
        plannedQtyToDate,
        executedQuantity,
        quantityVariance: money(executedQuantity.minus(plannedQuantity)),
        plannedUnitRate,
        actualUnitCost,
        unitRateVariance: actualUnitCost ? money(plannedUnitRate.minus(actualUnitCost)) : null,
        plannedBudgetCost,
        earnedBudgetCost,
        allocatedActualCost,
        costVariance: money(earnedBudgetCost.minus(allocatedActualCost)),
        materials: {
          plannedUnitCost: plannedMaterialUnit,
          plannedConsumed,
          actualConsumed,
          variance: money(plannedConsumed.minus(actualConsumed)),
        },
        elements: this.elementTotals(item),
      };
    });

    return {
      companyId,
      projectId,
      asOfDate,
      totals: {
        plannedQuantity: sumItem(items, (row) => row.plannedQuantity),
        executedQuantity: sumItem(items, (row) => row.executedQuantity),
        plannedBudgetCost: sumItem(items, (row) => row.plannedBudgetCost),
        earnedBudgetCost: sumItem(items, (row) => row.earnedBudgetCost),
        allocatedActualCost: sumItem(items, (row) => row.allocatedActualCost),
        costVariance: sumItem(items, (row) => row.costVariance),
        plannedMaterials: sumItem(items, (row) => row.materials.plannedConsumed),
        actualMaterials: sumItem(items, (row) => row.materials.actualConsumed),
        materialVariance: sumItem(items, (row) => row.materials.variance),
      },
      items,
    };
  }

  private async loadProjectContext(companyId: string, projectId: string, asOfDate: Date) {
    const project = await prisma.contractingProject.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) throw new ContractingProjectNotFoundError(companyId, projectId);

    const [boqItems, actuals] = await Promise.all([
      prisma.projectBOQItem.findMany({
        where: { companyId, projectId },
        include: { rateAnalysisItems: true },
        orderBy: { itemCode: 'asc' },
      }),
      this.computeActualCost(prisma, companyId, projectId, project.costCenterId, asOfDate),
    ]);

    return {
      project,
      boqItems,
      actuals,
      elapsedFraction: this.elapsedFraction(project.startDate, project.endDate, asOfDate),
      asOfDate,
    };
  }

  /**
   * Time-phased planned quantity: linear interpolation of contractQuantity
   * between project startDate and endDate. Full BAC is planned when dates
   * are missing or the as-of date is past the finish date.
   */
  private plannedQtyToDate(
    item: OwnerBoqRow,
    ctx: { project: { startDate: Date | null; endDate: Date | null }; asOfDate: Date }
  ): Decimal {
    const contractQuantity = money(item.contractQuantity);
    const { startDate, endDate } = ctx.project;
    const asOf = ctx.asOfDate;

    if (startDate && asOf < startDate) return moneyZero();
    if (endDate && asOf >= endDate) return contractQuantity;
    if (startDate && endDate) {
      const totalMs = endDate.getTime() - startDate.getTime();
      if (totalMs <= 0) return contractQuantity;
      const elapsedMs = asOf.getTime() - startDate.getTime();
      return money(contractQuantity.mul(Math.min(1, Math.max(0, elapsedMs / totalMs))));
    }
    return contractQuantity;
  }

  private elapsedFraction(
    startDate: Date | null,
    endDate: Date | null,
    asOf: Date
  ): Decimal {
    if (!startDate || !endDate) {
      if (startDate && asOf < startDate) return rate(0);
      return rate(1);
    }
    const totalMs = endDate.getTime() - startDate.getTime();
    if (totalMs <= 0) return rate(1);
    return rate(Math.min(1, Math.max(0, (asOf.getTime() - startDate.getTime()) / totalMs)));
  }

  /**
   * AC = posted subcontractor extracts + warehouse issues to site +
   * direct site labour / plant posted on the project's cost centre.
   */
  private async computeActualCost(
    db: Db,
    companyId: string,
    projectId: string,
    costCenterId: string | null,
    asOfDate: Date
  ): Promise<EvmActualCostBreakdown> {
    const [subcontractorCosts, warehouseIssueCosts, installedSiteStockCosts, directSiteExpenses] =
      await Promise.all([
        this.sumPostedSubcontractorCosts(db, companyId, projectId, asOfDate),
        this.sumWarehouseIssueCosts(db, companyId, projectId, asOfDate),
        this.sumInstalledSiteStock(db, companyId, projectId, asOfDate),
        this.sumDirectSiteExpenses(db, companyId, projectId, costCenterId, asOfDate),
      ]);

    const materialCosts = money(warehouseIssueCosts.plus(installedSiteStockCosts));
    return {
      subcontractorCosts,
      materialCosts,
      warehouseIssueCosts,
      installedSiteStockCosts,
      directSiteExpenses,
      actualCost: money(subcontractorCosts.plus(materialCosts).plus(directSiteExpenses)),
    };
  }

  private async sumPostedSubcontractorCosts(
    db: Db,
    companyId: string,
    projectId: string,
    asOfDate: Date
  ): Promise<Decimal> {
    const invoices = await db.subcontractInvoice.findMany({
      where: {
        companyId,
        status: { in: [...POSTED_SUBCONTRACT_INVOICE_STATUSES] },
        periodEndDate: { lte: asOfDate },
        subcontract: { companyId, projectId },
      },
      select: {
        subcontractId: true,
        sequenceNumber: true,
        grossCumulativeAmount: true,
      },
      orderBy: [{ subcontractId: 'asc' }, { sequenceNumber: 'desc' }],
    });

    const latestBySubcontract = new Map<string, Decimal>();
    for (const invoice of invoices) {
      if (latestBySubcontract.has(invoice.subcontractId)) continue;
      latestBySubcontract.set(invoice.subcontractId, money(invoice.grossCumulativeAmount));
    }

    return sumIterable(latestBySubcontract.values());
  }

  private async sumWarehouseIssueCosts(
    db: Db,
    companyId: string,
    projectId: string,
    asOfDate: Date
  ): Promise<Decimal> {
    const logs = await db.materialReconciliationLog.findMany({
      where: {
        subcontract: { companyId, projectId },
        createdAt: { lte: asOfDate },
      },
      select: {
        actualIssuedQty: true,
        marketPricePerUnit: true,
      },
    });

    return sumItem(logs, (row) => money(money(row.actualIssuedQty).mul(money(row.marketPricePerUnit))));
  }

  private async sumInstalledSiteStock(
    db: Db,
    companyId: string,
    projectId: string,
    asOfDate: Date
  ): Promise<Decimal> {
    const rows = await db.siteStockMaterial.findMany({
      where: {
        companyId,
        projectId,
        status: 'INSTALLED_AND_DEDUCTED',
        deliveryDate: { lte: asOfDate },
      },
      select: {
        deliveredQuantity: true,
        unitPrice: true,
      },
    });

    return sumItem(rows, (row) => money(money(row.deliveredQuantity).mul(money(row.unitPrice))));
  }

  private async sumDirectSiteExpenses(
    db: Db,
    companyId: string,
    projectId: string,
    costCenterId: string | null,
    asOfDate: Date
  ): Promise<Decimal> {
    if (!costCenterId) return moneyZero();

    const [subcontractJeIds, clientJeIds] = await Promise.all([
      db.subcontractInvoice.findMany({
        where: {
          companyId,
          journalEntryId: { not: null },
          subcontract: { companyId, projectId },
        },
        select: { journalEntryId: true },
      }),
      db.clientInvoice.findMany({
        where: {
          companyId,
          journalEntryId: { not: null },
          clientContract: { companyId, projectId },
        },
        select: { journalEntryId: true },
      }),
    ]);

    const excludedJeIds = [
      ...subcontractJeIds.map((row) => row.journalEntryId),
      ...clientJeIds.map((row) => row.journalEntryId),
    ].filter((id): id is string => Boolean(id));

    const lines = await db.journalEntryLine.findMany({
      where: {
        costCenterId,
        journalEntry: {
          companyId,
          isPosted: true,
          deletedAt: null,
          isCancelled: false,
          date: { lte: asOfDate },
          ...(excludedJeIds.length ? { id: { notIn: excludedJeIds } } : {}),
        },
      },
      select: {
        debitBase: true,
        creditBase: true,
        account: { select: { code: true, accountType: true } },
      },
    });

    let total = moneyZero();
    for (const line of lines) {
      const cls = classifyAccount(line.account.code, line.account.accountType);
      if (cls !== 'EXPENSE' && cls !== 'COGS') continue;
      total = money(total.plus(money(line.debitBase).minus(money(line.creditBase))));
    }
    return money(total);
  }

  private elementUnitCost(item: OwnerBoqRow, type: BOQCostElementType): Decimal {
    return item.rateAnalysisItems
      .filter((row) => row.costElementType === type)
      .reduce((acc, row) => money(acc.plus(row.totalCostPerUnit)), moneyZero());
  }

  private elementTotals(item: OwnerBoqRow): Record<BOQCostElementType, Decimal> {
    const totals = Object.fromEntries(ELEMENT_TYPES.map((type) => [type, moneyZero()])) as Record<
      BOQCostElementType,
      Decimal
    >;
    for (const row of item.rateAnalysisItems) {
      totals[row.costElementType] = money(totals[row.costElementType].plus(row.totalCostPerUnit));
    }
    return totals;
  }
}

function sumItem<T>(rows: T[], pick: (row: T) => Decimal): Decimal {
  return rows.reduce((acc, row) => money(acc.plus(pick(row))), moneyZero());
}

function sumIterable(values: Iterable<Decimal>): Decimal {
  let acc = moneyZero();
  for (const value of values) acc = money(acc.plus(value));
  return acc;
}

export const projectCostControlService = new ProjectCostControlService();
