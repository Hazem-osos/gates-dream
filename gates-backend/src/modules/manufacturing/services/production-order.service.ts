import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { journalPostingService, type JournalPostingContext } from '../../accounting/services/journal-posting.service';
import { itemCostService } from '../../inventory/services/item-cost.service';
import { stockMovementService } from '../../inventory/services/stock-movement.service';
import { bomService } from './bom.service';
import { manufacturingCostingService } from './manufacturing-costing.service';

export interface CreateProductionOrderInput {
  orderNumber: string;
  bomId: string;
  plannedQuantity: number;
  warehouseIdRaw: string;
  warehouseIdFinished: string;
  branchId?: string;
  fiscalYearId?: string;
  sourceYearId?: string;
}

export class ProductionOrderService {
  async create(companyId: string, input: CreateProductionOrderInput) {
    const bom = await bomService.getById(companyId, input.bomId);
    if (input.plannedQuantity <= 0) {
      throw new AppError(422, 'Planned quantity must be positive');
    }

    return prisma.productionOrder.create({
      data: {
        companyId,
        branchId: input.branchId,
        fiscalYearId: input.fiscalYearId,
        sourceYearId: input.sourceYearId,
        orderNumber: input.orderNumber,
        bomId: bom.id,
        finishedItemId: bom.finishedItemId,
        plannedQuantity: new Decimal(input.plannedQuantity),
        warehouseIdRaw: input.warehouseIdRaw,
        warehouseIdFinished: input.warehouseIdFinished,
        status: 'DRAFT',
      },
      include: { bom: { include: { lines: true } } },
    });
  }

  async getById(companyId: string, id: string) {
    const order = await prisma.productionOrder.findFirst({
      where: { id, companyId },
      include: {
        bom: { include: { lines: true } },
        materialIssues: { include: { lines: true } },
        finishedItem: { select: { id: true, arabicName: true } },
      },
    });
    if (!order) throw new AppError(404, 'Production order not found');
    return order;
  }

  async list(
    companyId: string,
    filters: { status?: string; limit?: number } = {}
  ) {
    return prisma.productionOrder.findMany({
      where: {
        companyId,
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        finishedItem: { select: { id: true, arabicName: true, serial: true } },
        bom: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(filters.limit ?? 100, 500),
    });
  }

  async release(companyId: string, orderId: string) {
    const order = await this.getById(companyId, orderId);
    if (order.status !== 'DRAFT') {
      throw new AppError(400, 'Only DRAFT orders can be released');
    }

    const requirements = await bomService.explodeRequirements(
      order.bomId,
      Number(order.plannedQuantity)
    );

    for (const req of requirements) {
      await stockMovementService.assertNegativeStockAllowed(
        companyId,
        order.warehouseIdRaw,
        req.rawItemId,
        null,
        -req.quantity
      );
    }

    return prisma.productionOrder.update({
      where: { id: orderId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
  }

  /**
   * Wave 3 fix: `CANCELLED` was documented on `status` but nothing ever
   * wrote it — a DRAFT/RELEASED order created by mistake had no way to
   * close out. Only allowed before any GL/stock effect exists (materials
   * not yet issued); past that point the sanctioned path is to unwind via
   * `unpostMaterialIssue`/`unpostLaborOverhead`/`unpostCompletion` first,
   * which brings the order back to RELEASED, and cancel from there.
   */
  async cancel(companyId: string, orderId: string) {
    const order = await this.getById(companyId, orderId);
    if (order.status === 'CANCELLED') {
      throw new AppError(400, 'Production order is already cancelled');
    }
    if (order.status !== 'DRAFT' && order.status !== 'RELEASED') {
      throw new AppError(
        422,
        `Cannot cancel a ${order.status} production order — unpost materials/costs/completion first`
      );
    }
    return prisma.productionOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });
  }

  async issueMaterials(ctx: JournalPostingContext, orderId: string) {
    const order = await this.getById(ctx.companyId, orderId);
    if (order.status !== 'RELEASED' && order.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'Order must be RELEASED to issue materials');
    }
    if (order.materialsIssueJournalEntryId) {
      throw new AppError(409, 'Materials already issued for this order');
    }

    const requirements = await bomService.explodeRequirements(
      order.bomId,
      Number(order.plannedQuantity)
    );
    const issueDate = new Date();
    const issueLines: Array<{
      rawItemId: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
    }> = [];

    for (const req of requirements) {
      const unitCost = await itemCostService.getCostAsOf(
        ctx.companyId,
        req.rawItemId,
        issueDate
      );
      const totalCost = roundTo4(req.quantity * unitCost);
      issueLines.push({
        rawItemId: req.rawItemId,
        quantity: req.quantity,
        unitCost,
        totalCost,
      });
    }

    const totalMaterialCost = roundTo4(
      issueLines.reduce((s, l) => s + l.totalCost, 0)
    );

    return prisma.$transaction(async (tx) => {
      for (const line of issueLines) {
        await stockMovementService.postMovementInTx(tx, {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          warehouseId: order.warehouseIdRaw,
          itemId: line.rawItemId,
          quantityDelta: -line.quantity,
          unitCost: line.unitCost,
          movementType: 'PROD_ISSUE',
          sourceType: 'MO',
          sourceNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? undefined,
          documentDate: issueDate,
        });
      }

      const je = await manufacturingCostingService.postMaterialIssue(ctx, tx, {
        orderNumber: order.orderNumber,
        sourceYearId: order.sourceYearId ?? undefined,
        totalMaterialCost,
        issueDate,
      });

      const issue = await tx.productionMaterialIssue.create({
        data: {
          productionOrderId: orderId,
          issueDate,
          journalEntryId: je.id,
          totalCost: new Decimal(totalMaterialCost),
          lines: {
            create: issueLines.map((l) => ({
              rawItemId: l.rawItemId,
              quantity: new Decimal(l.quantity),
              unitCost: new Decimal(l.unitCost),
              totalCost: new Decimal(l.totalCost),
            })),
          },
        },
        include: { lines: true },
      });

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'IN_PROGRESS',
          totalMaterialCost: new Decimal(totalMaterialCost),
          materialsIssueJournalEntryId: je.id,
        },
        include: { materialIssues: { include: { lines: true } } },
      });
    });
  }

  async addLaborOverhead(
    ctx: JournalPostingContext,
    orderId: string,
    laborCost: number,
    overheadCost: number
  ) {
    const order = await this.getById(ctx.companyId, orderId);
    if (order.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'Order must be IN_PROGRESS');
    }
    if (order.laborOverheadJournalEntryId) {
      throw new AppError(409, 'Labor/overhead already posted');
    }

    const postingDate = new Date();
    return prisma.$transaction(async (tx) => {
      const je = await manufacturingCostingService.postLaborOverhead(ctx, tx, {
        orderNumber: order.orderNumber,
        sourceYearId: order.sourceYearId ?? undefined,
        laborCost,
        overheadCost,
        postingDate,
      });

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          totalLaborCost: new Decimal(roundTo4(laborCost)),
          totalOverheadCost: new Decimal(roundTo4(overheadCost)),
          laborOverheadJournalEntryId: je.id,
        },
      });
    });
  }

  async complete(
    ctx: JournalPostingContext,
    orderId: string,
    actualQuantity: number
  ) {
    const order = await this.getById(ctx.companyId, orderId);
    if (order.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'Order must be IN_PROGRESS to complete');
    }
    if (!order.materialsIssueJournalEntryId || !order.laborOverheadJournalEntryId) {
      throw new AppError(422, 'Issue materials and labor/overhead before completion');
    }
    if (actualQuantity <= 0) throw new AppError(422, 'Actual quantity must be positive');

    const materialCost = Number(order.totalMaterialCost);
    const laborCost = Number(order.totalLaborCost);
    const overheadCost = Number(order.totalOverheadCost);
    const totalBatch = roundTo4(materialCost + laborCost + overheadCost);
    const unitCost = roundTo4(totalBatch / actualQuantity);
    const completionDate = new Date();

    return prisma.$transaction(async (tx) => {
      const je = await manufacturingCostingService.postCompletion(ctx, tx, {
        orderNumber: order.orderNumber,
        sourceYearId: order.sourceYearId ?? undefined,
        totalBatchCost: totalBatch,
        materialCost,
        laborOverheadCost: roundTo4(laborCost + overheadCost),
        completionDate,
      });

      await manufacturingCostingService.receiveFinishedGoodsInTx(tx, {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        warehouseId: order.warehouseIdFinished,
        itemId: order.finishedItemId,
        quantity: actualQuantity,
        unitCost,
        orderNumber: order.orderNumber,
        sourceYearId: order.sourceYearId ?? undefined,
        documentDate: completionDate,
      });

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          actualQuantity: new Decimal(actualQuantity),
          unitCost: new Decimal(unitCost),
          completionJournalEntryId: je.id,
          completedAt: completionDate,
        },
      });
    });
  }

  /**
   * Wave 2/3 fix: the MO pipeline (issue → labor/overhead → complete) had no
   * way back. These three reversal steps unwind strictly in reverse order —
   * each requires the later stage to already be undone — so a half-reversed
   * order is never left inconsistent.
   */
  async unpostCompletion(ctx: JournalPostingContext, orderId: string) {
    const order = await this.getById(ctx.companyId, orderId);
    if (order.status !== 'COMPLETED') {
      throw new AppError(400, 'Only a COMPLETED order has a completion to unpost');
    }
    if (!order.completionJournalEntryId) {
      throw new AppError(400, 'Order has no completion journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, order.completionJournalEntryId!, {
        reason: 'Production completion unposted',
      });

      const qty = Number(order.actualQuantity ?? 0);
      if (qty > 0) {
        await stockMovementService.postMovementInTx(tx, {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          warehouseId: order.warehouseIdFinished,
          itemId: order.finishedItemId,
          quantityDelta: -qty,
          unitCost: Number(order.unitCost ?? 0),
          movementType: 'PROD_RECEIPT_REVERSAL',
          sourceType: 'MO',
          sourceNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? undefined,
          documentDate: new Date(),
        });
      }
      await itemCostService.removeCostHistoryBySourceInTx(tx, {
        companyId: ctx.companyId,
        itemId: order.finishedItemId,
        sourceType: 'MO',
        sourceNumber: order.orderNumber,
        sourceYearId: order.sourceYearId ?? String(new Date().getUTCFullYear()),
      });

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'IN_PROGRESS',
          actualQuantity: null,
          unitCost: null,
          completionJournalEntryId: null,
          completedAt: null,
        },
      });
    });
  }

  async unpostLaborOverhead(ctx: JournalPostingContext, orderId: string) {
    const order = await this.getById(ctx.companyId, orderId);
    if (order.completionJournalEntryId) {
      throw new AppError(400, 'Unpost the completion before unposting labor/overhead');
    }
    if (!order.laborOverheadJournalEntryId) {
      throw new AppError(400, 'Order has no labor/overhead journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, order.laborOverheadJournalEntryId!, {
        reason: 'Production labor/overhead unposted',
      });

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          totalLaborCost: new Decimal(0),
          totalOverheadCost: new Decimal(0),
          laborOverheadJournalEntryId: null,
        },
      });
    });
  }

  async unpostMaterialIssue(ctx: JournalPostingContext, orderId: string) {
    const order = await this.getById(ctx.companyId, orderId);
    if (order.laborOverheadJournalEntryId) {
      throw new AppError(400, 'Unpost labor/overhead before unposting the material issue');
    }
    if (!order.materialsIssueJournalEntryId) {
      throw new AppError(400, 'Order has no material issue journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, order.materialsIssueJournalEntryId!, {
        reason: 'Production material issue unposted',
      });

      for (const issue of order.materialIssues) {
        for (const line of issue.lines) {
          await stockMovementService.postMovementInTx(tx, {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            warehouseId: order.warehouseIdRaw,
            itemId: line.rawItemId,
            quantityDelta: Number(line.quantity),
            unitCost: Number(line.unitCost),
            movementType: 'PROD_ISSUE_REVERSAL',
            sourceType: 'MO',
            sourceNumber: order.orderNumber,
            sourceYearId: order.sourceYearId ?? undefined,
            documentDate: new Date(),
          });
        }
      }
      await tx.productionMaterialIssue.deleteMany({ where: { productionOrderId: orderId } });

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'RELEASED',
          totalMaterialCost: new Decimal(0),
          materialsIssueJournalEntryId: null,
        },
      });
    });
  }
}

export const productionOrderService = new ProductionOrderService();
