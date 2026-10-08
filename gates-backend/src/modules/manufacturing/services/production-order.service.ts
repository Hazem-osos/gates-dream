import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { journalPostingService, type JournalPostingContext } from '../../accounting/services/journal-posting.service';
import { itemCostService } from '../../inventory/services/item-cost.service';
import { stockMovementService } from '../../inventory/services/stock-movement.service';
import { bomService } from './bom.service';
import { manufacturingCostingService } from './manufacturing-costing.service';
import { resolveManufacturingOrderNumberInTx } from './manufacturing-order-numbering.service';
import { materialRequirementsFromProcessMetadata } from '../utils/production-order-material-requirements';
import {
  additionalCostsTotalFromMetadata,
  productionMaterialPostingChanged,
  productionOrderUsesUnifiedIssue,
} from '../utils/production-order-posting.helpers';
import {
  assertProductionOrderQuantityWithinWorkOrderCap,
  markWorkOrderInProgressIfNeeded,
} from '../utils/work-order-progress';
import {
  finishedReceiptAtIssueFromMetadata,
  primaryFinishedOutputQuantity,
  withFinishedReceiptAtIssueMetadata,
  withoutFinishedReceiptAtIssueMetadata,
} from '../utils/production-order-finished-output';

export interface CreateProductionOrderInput {
  orderNumber: string;
  bomId: string;
  manufacturingWorkOrderId?: string | null;
  plannedQuantity: number;
  warehouseIdRaw: string;
  warehouseIdFinished: string;
  branchId?: string;
  fiscalYearId?: string;
  sourceYearId?: string;
  processMetadata?: Record<string, unknown>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function productionOrderCostCenterId(
  processMetadata: Record<string, unknown> | null | undefined
): string | undefined {
  const raw = processMetadata?.costCenter;
  if (typeof raw !== 'string') return undefined;
  const id = raw.trim();
  return UUID_RE.test(id) ? id : undefined;
}

async function assertWorkOrderLink(
  companyId: string,
  manufacturingWorkOrderId: string | null | undefined,
  bomId: string
) {
  if (!manufacturingWorkOrderId) return;
  const wo = await prisma.manufacturingWorkOrder.findFirst({
    where: { id: manufacturingWorkOrderId, companyId },
    select: { id: true, bomId: true, status: true, processMetadata: true },
  });
  if (!wo) throw new AppError(404, 'أمر التشغيل غير موجود');
  if (wo.status === 'CANCELLED') {
    throw new AppError(422, 'لا يمكن ربط أمر تصنيع بأمر تشغيل ملغي');
  }
  if (wo.status === 'COMPLETED' || wo.status === 'CLOSED') {
    throw new AppError(422, 'أمر الشغل منتهي أو مغلق — لا يمكن إنشاء أوامر تصنيع جديدة');
  }
  const meta = wo.processMetadata as { bomPlans?: Array<{ bomId?: string }> } | null;
  const allowed = new Set<string>();
  if (wo.bomId) allowed.add(wo.bomId);
  for (const row of meta?.bomPlans ?? []) {
    if (row.bomId?.trim()) allowed.add(row.bomId.trim());
  }
  if (allowed.size > 0 && !allowed.has(bomId)) {
    throw new AppError(422, 'نموذج التصنيع غير مرتبط بالتخطيط الإنتاجي / أمر الشغل');
  }
}

export type UpdateProductionOrderInput = CreateProductionOrderInput;

export class ProductionOrderService {
  async create(companyId: string, input: CreateProductionOrderInput) {
    const bom = await bomService.getById(companyId, input.bomId);
    await assertWorkOrderLink(companyId, input.manufacturingWorkOrderId, bom.id);
    if (input.plannedQuantity <= 0) {
      throw new AppError(422, 'Planned quantity must be positive');
    }
    if (input.manufacturingWorkOrderId) {
      await assertProductionOrderQuantityWithinWorkOrderCap(
        companyId,
        input.manufacturingWorkOrderId,
        bom.id,
        input.plannedQuantity
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const orderNumber = await resolveManufacturingOrderNumberInTx(tx, {
        companyId,
        branchId: input.branchId ?? null,
        fiscalYearId: input.fiscalYearId ?? null,
        clientSerial: input.orderNumber,
      });

      return tx.productionOrder.create({
        data: {
          companyId,
          branchId: input.branchId,
          fiscalYearId: input.fiscalYearId,
          sourceYearId: input.sourceYearId,
          orderNumber,
          bomId: bom.id,
          manufacturingWorkOrderId: input.manufacturingWorkOrderId ?? undefined,
          finishedItemId: bom.finishedItemId,
          plannedQuantity: new Decimal(input.plannedQuantity),
          warehouseIdRaw: input.warehouseIdRaw,
          warehouseIdFinished: input.warehouseIdFinished,
          processMetadata: input.processMetadata ?? undefined,
          status: 'RELEASED',
          releasedAt: new Date(),
        },
        include: { bom: { include: { lines: true } } },
      });
    });
    if (input.manufacturingWorkOrderId) {
      await markWorkOrderInProgressIfNeeded(companyId, input.manufacturingWorkOrderId);
    }
    return created;
  }

  async update(companyId: string, orderId: string, input: UpdateProductionOrderInput) {
    const order = await this.getById(companyId, orderId);
    if (order.status === 'CANCELLED') {
      throw new AppError(422, 'لا يمكن تعديل أمر ملغي');
    }
    if (order.status === 'COMPLETED') {
      throw new AppError(422, 'لا يمكن تعديل أمر منتهي — أرجعه لقيد التنفيذ أو ألغِه من القائمة');
    }
    if (input.plannedQuantity <= 0) {
      throw new AppError(422, 'Planned quantity must be positive');
    }

    const bom = await bomService.getById(companyId, input.bomId);
    await assertWorkOrderLink(companyId, input.manufacturingWorkOrderId, bom.id);
    if (input.manufacturingWorkOrderId) {
      await assertProductionOrderQuantityWithinWorkOrderCap(
        companyId,
        input.manufacturingWorkOrderId,
        bom.id,
        input.plannedQuantity,
        orderId
      );
    }
    const orderNumber = input.orderNumber?.trim();
    if (!orderNumber) {
      throw new AppError(422, 'رقم الأمر مطلوب');
    }

    if (order.materialsIssueJournalEntryId) {
      const fingerprintBefore = {
        bomId: order.bomId,
        plannedQuantity: Number(order.plannedQuantity),
        warehouseIdRaw: order.warehouseIdRaw,
        warehouseIdFinished: order.warehouseIdFinished,
        processMetadata: order.processMetadata as {
          rawLinesSnapshot?: Array<{ rawItemId?: string; quantity?: number }>;
        } | null,
      };
      const fingerprintAfter = {
        bomId: bom.id,
        plannedQuantity: input.plannedQuantity,
        warehouseIdRaw: input.warehouseIdRaw,
        warehouseIdFinished: input.warehouseIdFinished,
        processMetadata: input.processMetadata as {
          rawLinesSnapshot?: Array<{ rawItemId?: string; quantity?: number }>;
        } | null,
      };
      if (productionMaterialPostingChanged(fingerprintBefore, fingerprintAfter)) {
        throw new AppError(
          422,
          'تم ترحيل صرف الخامات. لتعديل الخامات أو الكميات أو المخازن: من القائمة (⋯) اختر «فك صرف الخامات» ثم عدّل وأعد «بدء التنفيذ».'
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const clash = await tx.productionOrder.findFirst({
        where: {
          companyId,
          orderNumber,
          id: { not: orderId },
        },
        select: { id: true },
      });
      if (clash) {
        throw new AppError(409, 'رقم الأمر مستخدم مسبقاً');
      }

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          orderNumber,
          bomId: bom.id,
          manufacturingWorkOrderId: input.manufacturingWorkOrderId ?? undefined,
          finishedItemId: bom.finishedItemId,
          plannedQuantity: new Decimal(input.plannedQuantity),
          warehouseIdRaw: input.warehouseIdRaw,
          warehouseIdFinished: input.warehouseIdFinished,
          processMetadata: input.processMetadata ?? undefined,
        },
        include: {
          bom: { include: { lines: true } },
          finishedItem: { select: { id: true, arabicName: true, serial: true } },
        },
      });
    });
  }

  async getById(companyId: string, id: string) {
    const order = await prisma.productionOrder.findFirst({
      where: { id, companyId },
      include: {
        bom: { include: { lines: true } },
        materialIssues: { include: { lines: true } },
        finishedItem: { select: { id: true, arabicName: true } },
        manufacturingWorkOrder: {
          select: { id: true, orderNumber: true, status: true, modelQuantity: true },
        },
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

    return prisma.productionOrder.update({
      where: { id: orderId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
  }

  /**
   * إلغاء إداري: الحالة CANCELLED فقط — بدون عكس قيود أو مخزون.
   * لعكس التأثيرات: فك الإتمام / فك الأجور / فك صرف الخامات من القائمة.
   */
  async cancel(companyId: string, orderId: string) {
    const order = await this.getById(companyId, orderId);
    if (order.status === 'CANCELLED') {
      throw new AppError(400, 'أمر التصنيع ملغي بالفعل');
    }
    return prisma.productionOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * إلغاء أمر منتهي: عكس مخزون + إلغاء قيود المصدر (ملغي وغير مرحّل).
   * القيود تبقى مربوطة بأمر التصنيع — لا تعديل يدوي من قيد اليومية.
   */
  async cancelCompletedOrder(ctx: JournalPostingContext, companyId: string, orderId: string) {
    const order = await this.getById(companyId, orderId);
    if (order.status === 'CANCELLED') {
      throw new AppError(400, 'أمر التصنيع ملغي بالفعل');
    }
    if (order.status !== 'COMPLETED') {
      throw new AppError(422, 'إلغاء الأمر المتاح للأوامر المنتهية فقط');
    }

    const journalEntryIds = [
      order.completionJournalEntryId,
      order.laborOverheadJournalEntryId,
      order.materialsIssueJournalEntryId,
      order.additionalCostsJournalEntryId,
    ];

    return prisma.$transaction(async (tx) => {
      const receiptAtIssue = finishedReceiptAtIssueFromMetadata(order.processMetadata);
      const qty = Number(order.actualQuantity ?? 0);
      const baselineQty = receiptAtIssue?.quantity ?? qty;
      const deltaFromComplete = roundTo4(qty - baselineQty);

      if (Math.abs(deltaFromComplete) > 0.0001) {
        await stockMovementService.postMovementInTx(tx, {
          companyId,
          branchId: ctx.branchId ?? undefined,
          warehouseId: order.warehouseIdFinished,
          itemId: order.finishedItemId,
          quantityDelta: -deltaFromComplete,
          unitCost: Number(order.unitCost ?? 0),
          movementType: 'PROD_RECEIPT_REVERSAL',
          sourceType: 'MO',
          sourceNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? undefined,
          documentDate: new Date(),
        });
        await itemCostService.removeCostHistoryBySourceInTx(tx, {
          companyId,
          itemId: order.finishedItemId,
          sourceType: 'MO',
          sourceNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? String(new Date().getUTCFullYear()),
        });
      }

      for (const issue of order.materialIssues) {
        for (const line of issue.lines) {
          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: ctx.branchId ?? undefined,
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

      if (receiptAtIssue && receiptAtIssue.quantity > 0) {
        await stockMovementService.postMovementInTx(tx, {
          companyId,
          branchId: ctx.branchId ?? undefined,
          warehouseId: order.warehouseIdFinished,
          itemId: order.finishedItemId,
          quantityDelta: -receiptAtIssue.quantity,
          unitCost: receiptAtIssue.unitCost,
          movementType: 'PROD_RECEIPT_REVERSAL',
          sourceType: 'MO',
          sourceNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? undefined,
          documentDate: new Date(),
        });
        await itemCostService.removeCostHistoryBySourceInTx(tx, {
          companyId,
          itemId: order.finishedItemId,
          sourceType: 'MO',
          sourceNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? String(new Date().getUTCFullYear()),
        });
      }

      await tx.productionMaterialIssue.deleteMany({ where: { productionOrderId: orderId } });

      await journalPostingService.cascadeSourceJournalInTx(
        tx,
        companyId,
        journalEntryIds,
        'cancel',
        ctx.userId,
        {
          sourceId: orderId,
          sourceType: 'MO',
          sourceNumber: order.orderNumber,
        }
      );

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          completionJournalEntryId: null,
          laborOverheadJournalEntryId: null,
          materialsIssueJournalEntryId: null,
          additionalCostsJournalEntryId: null,
          totalMaterialCost: new Decimal(0),
          totalLaborCost: new Decimal(0),
          totalOverheadCost: new Decimal(0),
          actualQuantity: null,
          unitCost: null,
          completedAt: null,
          processMetadata: withoutFinishedReceiptAtIssueMetadata(order.processMetadata),
        },
      });
    });
  }

  /** حذف نهائي — غير متاح للأوامر المنتهية (استخدم الإلغاء). */
  async permanentDelete(ctx: JournalPostingContext, companyId: string, orderId: string) {
    const order = await this.getById(companyId, orderId);
    if (order.status === 'COMPLETED') {
      throw new AppError(422, 'لا يمكن حذف أمر منتهي — استخدم «إلغاء الأمر» من القائمة');
    }
    if (order.status !== 'CANCELLED') {
      if (order.completionJournalEntryId) {
        await this.unpostCompletion(ctx, orderId);
      }
      const mid = await this.getById(companyId, orderId);
      if (mid.laborOverheadJournalEntryId) {
        await this.unpostLaborOverhead(ctx, orderId);
      }
      const mid2 = await this.getById(companyId, orderId);
      if (mid2.materialsIssueJournalEntryId) {
        await this.unpostMaterialIssue(ctx, orderId);
      }
    }
    await prisma.productionOrder.delete({ where: { id: orderId } });
    return { id: orderId, deleted: true as const };
  }

  async issueMaterials(ctx: JournalPostingContext, orderId: string) {
    const order = await this.getById(ctx.companyId, orderId);
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new AppError(422, 'لا يمكن بدء تنفيذ أمر منتهي أو ملغي');
    }
    if (order.status === 'DRAFT') {
      await prisma.productionOrder.update({
        where: { id: orderId },
        data: { status: 'RELEASED', releasedAt: new Date() },
      });
    } else if (order.status !== 'RELEASED' && order.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'Order must be confirmed before issuing materials');
    }
    if (order.materialsIssueJournalEntryId) {
      throw new AppError(409, 'Materials already issued for this order');
    }

    const fromSnapshot = materialRequirementsFromProcessMetadata(
      order.processMetadata as { rawLinesSnapshot?: Array<{ rawItemId?: string; quantity?: number }> } | null
    );
    const requirements =
      fromSnapshot ??
      (await bomService.explodeRequirements(order.bomId, Number(order.plannedQuantity)));
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
          branchId: ctx.branchId ?? undefined,
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

      const meta = order.processMetadata as {
        additionalCosts?: Array<{ accountId?: string; accountLabel?: string; value?: number }>;
      } | null;
      const additionalCosts = (meta?.additionalCosts ?? []).filter(
        (c) =>
          (Number(c.value) || 0) > 0 &&
          Boolean(c.accountId?.trim() || c.accountLabel?.trim())
      );
      const useUnified = additionalCosts.length > 0;
      const costCenterId = productionOrderCostCenterId(
        order.processMetadata as Record<string, unknown> | null
      );

      const je = useUnified
        ? await manufacturingCostingService.postUnifiedMaterialAndAdditional(ctx, tx, {
            productionOrderId: orderId,
            orderNumber: order.orderNumber,
            sourceYearId: order.sourceYearId ?? undefined,
            fromWarehouseId: order.warehouseIdRaw,
            toWarehouseId: order.warehouseIdFinished,
            materialCost: totalMaterialCost,
            additionalCosts,
            issueDate,
            costCenterId,
          })
        : await manufacturingCostingService.postMaterialIssue(ctx, tx, {
            productionOrderId: orderId,
            orderNumber: order.orderNumber,
            sourceYearId: order.sourceYearId ?? undefined,
            totalMaterialCost,
            issueDate,
            costCenterId,
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

      const outputQty = primaryFinishedOutputQuantity(order);
      const additionalAtIssue = useUnified
        ? additionalCostsTotalFromMetadata(order.processMetadata)
        : 0;
      const provisionalBatch = roundTo4(totalMaterialCost + additionalAtIssue);
      const provisionalUnitCost =
        outputQty > 0 ? roundTo4(provisionalBatch / outputQty) : 0;

      if (outputQty > 0 && order.finishedItemId) {
        await manufacturingCostingService.receiveFinishedGoodsInTx(tx, {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          warehouseId: order.warehouseIdFinished,
          itemId: order.finishedItemId,
          quantity: outputQty,
          unitCost: provisionalUnitCost,
          orderNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? undefined,
          documentDate: issueDate,
        });
      }

      const finishedReceiptAtIssue =
        outputQty > 0
          ? {
              quantity: outputQty,
              unitCost: provisionalUnitCost,
              receivedAt: issueDate.toISOString(),
            }
          : null;

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'IN_PROGRESS',
          totalMaterialCost: new Decimal(totalMaterialCost),
          materialsIssueJournalEntryId: je.id,
          ...(useUnified ? { additionalCostsJournalEntryId: je.id } : {}),
          ...(finishedReceiptAtIssue
            ? {
                actualQuantity: new Decimal(finishedReceiptAtIssue.quantity),
                unitCost: new Decimal(finishedReceiptAtIssue.unitCost),
                processMetadata: withFinishedReceiptAtIssueMetadata(
                  order.processMetadata,
                  finishedReceiptAtIssue
                ),
              }
            : {}),
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
    const costCenterId = productionOrderCostCenterId(
      order.processMetadata as Record<string, unknown> | null
    );
    return prisma.$transaction(async (tx) => {
      const je = await manufacturingCostingService.postLaborOverhead(ctx, tx, {
        productionOrderId: orderId,
        orderNumber: order.orderNumber,
        sourceYearId: order.sourceYearId ?? undefined,
        laborCost,
        overheadCost,
        postingDate,
        costCenterId,
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
    const laborBooked = Number(order.totalLaborCost);
    const overheadBooked = Number(order.totalOverheadCost);
    const needsLaborJournal = laborBooked > 0 || overheadBooked > 0;
    if (!order.materialsIssueJournalEntryId || (needsLaborJournal && !order.laborOverheadJournalEntryId)) {
      throw new AppError(422, 'صرف الخامات قبل إنهاء أمر التصنيع');
    }
    if (actualQuantity <= 0) throw new AppError(422, 'Actual quantity must be positive');

    const materialCost = Number(order.totalMaterialCost);
    const laborCost = Number(order.totalLaborCost);
    const overheadCost = Number(order.totalOverheadCost);
    const useUnifiedIssue = productionOrderUsesUnifiedIssue(order);
    const additionalAtIssue = useUnifiedIssue
      ? additionalCostsTotalFromMetadata(order.processMetadata)
      : 0;
    const totalBatch = roundTo4(
      materialCost + laborCost + overheadCost + additionalAtIssue
    );
    const unitCost = roundTo4(totalBatch / actualQuantity);
    const completionDate = new Date();
    const laborOverheadTotal = roundTo4(laborCost + overheadCost);

    return prisma.$transaction(async (tx) => {
      let completionJournalEntryId: string | null = null;
      if (useUnifiedIssue) {
        // Unified issue already Dr destination inventory (+ expenses) / Cr raw inventory for materials.
        // Closing JE only books labor/overhead into finished goods — avoid double-counting WIP materials.
        if (laborOverheadTotal > 0) {
          const je = await manufacturingCostingService.postCompletion(ctx, tx, {
            productionOrderId: orderId,
            orderNumber: order.orderNumber,
            sourceYearId: order.sourceYearId ?? undefined,
            totalBatchCost: laborOverheadTotal,
            materialCost: 0,
            laborOverheadCost: laborOverheadTotal,
            completionDate,
          });
          completionJournalEntryId = je.id;
        }
      } else {
        const je = await manufacturingCostingService.postCompletion(ctx, tx, {
          productionOrderId: orderId,
          orderNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? undefined,
          totalBatchCost: totalBatch,
          materialCost,
          laborOverheadCost: laborOverheadTotal,
          completionDate,
        });
        completionJournalEntryId = je.id;
      }

      const receiptAtIssue = finishedReceiptAtIssueFromMetadata(order.processMetadata);
      const baselineQty = receiptAtIssue?.quantity ?? 0;
      const deltaQty = roundTo4(actualQuantity - baselineQty);

      if (!receiptAtIssue) {
        await manufacturingCostingService.receiveFinishedGoodsInTx(tx, {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          warehouseId: order.warehouseIdFinished,
          itemId: order.finishedItemId,
          quantity: actualQuantity,
          unitCost,
          orderNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? undefined,
          documentDate: completionDate,
        });
      } else if (Math.abs(deltaQty) > 0.0001) {
        if (deltaQty > 0) {
          await manufacturingCostingService.receiveFinishedGoodsInTx(tx, {
            companyId: ctx.companyId,
            branchId: ctx.branchId ?? undefined,
            warehouseId: order.warehouseIdFinished,
            itemId: order.finishedItemId,
            quantity: deltaQty,
            unitCost,
            orderNumber: order.orderNumber,
            sourceYearId: order.sourceYearId ?? undefined,
            documentDate: completionDate,
          });
        } else {
          await stockMovementService.postMovementInTx(tx, {
            companyId: ctx.companyId,
            branchId: ctx.branchId ?? undefined,
            warehouseId: order.warehouseIdFinished,
            itemId: order.finishedItemId,
            quantityDelta: deltaQty,
            unitCost,
            movementType: 'PROD_RECEIPT_ADJUST',
            sourceType: 'MO',
            sourceNumber: order.orderNumber,
            sourceYearId: order.sourceYearId ?? undefined,
            documentDate: completionDate,
          });
        }
      }

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          actualQuantity: new Decimal(actualQuantity),
          unitCost: new Decimal(unitCost),
          completionJournalEntryId,
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
    return prisma.$transaction(async (tx) => {
      if (order.completionJournalEntryId) {
        await journalPostingService.reverseJournalEntryInTx(tx, ctx, order.completionJournalEntryId, {
          reason: 'Production completion unposted',
        });
      }

      const receiptAtIssue = finishedReceiptAtIssueFromMetadata(order.processMetadata);
      const qty = Number(order.actualQuantity ?? 0);
      const baselineQty = receiptAtIssue?.quantity ?? qty;
      const deltaFromComplete = roundTo4(qty - baselineQty);

      if (Math.abs(deltaFromComplete) > 0.0001) {
        await stockMovementService.postMovementInTx(tx, {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          warehouseId: order.warehouseIdFinished,
          itemId: order.finishedItemId,
          quantityDelta: -deltaFromComplete,
          unitCost: Number(order.unitCost ?? 0),
          movementType: 'PROD_RECEIPT_REVERSAL',
          sourceType: 'MO',
          sourceNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? undefined,
          documentDate: new Date(),
        });
        await itemCostService.removeCostHistoryBySourceInTx(tx, {
          companyId: ctx.companyId,
          itemId: order.finishedItemId,
          sourceType: 'MO',
          sourceNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? String(new Date().getUTCFullYear()),
        });
      }

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'IN_PROGRESS',
          ...(receiptAtIssue
            ? {
                actualQuantity: new Decimal(receiptAtIssue.quantity),
                unitCost: new Decimal(receiptAtIssue.unitCost),
              }
            : {
                actualQuantity: null,
                unitCost: null,
              }),
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
            branchId: ctx.branchId ?? undefined,
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

      const receiptAtIssue = finishedReceiptAtIssueFromMetadata(order.processMetadata);
      if (receiptAtIssue && receiptAtIssue.quantity > 0) {
        await stockMovementService.postMovementInTx(tx, {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          warehouseId: order.warehouseIdFinished,
          itemId: order.finishedItemId,
          quantityDelta: -receiptAtIssue.quantity,
          unitCost: receiptAtIssue.unitCost,
          movementType: 'PROD_RECEIPT_REVERSAL',
          sourceType: 'MO',
          sourceNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? undefined,
          documentDate: new Date(),
        });
        await itemCostService.removeCostHistoryBySourceInTx(tx, {
          companyId: ctx.companyId,
          itemId: order.finishedItemId,
          sourceType: 'MO',
          sourceNumber: order.orderNumber,
          sourceYearId: order.sourceYearId ?? String(new Date().getUTCFullYear()),
        });
      }

      await tx.productionMaterialIssue.deleteMany({ where: { productionOrderId: orderId } });

      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'RELEASED',
          totalMaterialCost: new Decimal(0),
          materialsIssueJournalEntryId: null,
          additionalCostsJournalEntryId: null,
          actualQuantity: null,
          unitCost: null,
          processMetadata: withoutFinishedReceiptAtIssueMetadata(order.processMetadata),
        },
      });
    });
  }
}

export const productionOrderService = new ProductionOrderService();
