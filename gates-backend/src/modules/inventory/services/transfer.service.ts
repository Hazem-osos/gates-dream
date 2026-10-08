import prisma from '../../../shared/database/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '../../../shared/logger';
import { stockMovementService } from './stock-movement.service';
import { inventoryCostingService } from './inventory-costing.service';
import { COSTING_MOVEMENT } from './inventory-costing-math';
import { stockMovementGlService, type StockGlPostingContext } from './stock-movement-gl.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { assertStoreDocumentRight } from './store-document-rights';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { sortForStockLocking, stockLockSortKey } from '../utils/stock-lock-order.util';
import type { PostStockMovementInput } from './stock-movement.service';
import { bulkCreateMany } from '../../../shared/database/bulk-write';
import { assertUpdateCount } from '../../../shared/concurrency/optimistic-lock';
import { assertWarehouseActive } from '../utils/inventory-system';
import { claimDocumentPost, claimDocumentUnpost } from '../utils/claim-document-post';
import { AppError } from '../../../shared/middleware/error-handler';
import { resolveStoreDocumentSerialInTx } from './store-document-numbering.service';
import {
  ensurePerpetualInventoryGlReady,
  runCompanyStockGlPosting,
} from '../utils/stock-gl-posting-guard';

function transferSourceNumber(transfer: { id: string; serial: string | null }): string {
  return (transfer.serial?.trim() || transfer.id.slice(0, 8)).slice(0, 30);
}

async function companyDefaultBranchId(companyId: string): Promise<string | null> {
  const row = await prisma.branch.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function warehouseBranchId(companyId: string, warehouseId: string): Promise<string | null> {
  const row = await prisma.warehouse.findFirst({
    where: { id: warehouseId, companyId },
    select: { branchId: true },
  });
  const id = row?.branchId?.trim();
  return id || null;
}

/**
 * Wave 4 fix: a transfer locks *two* warehouse legs per item (source then
 * destination). Two transfers moving the same item in opposite directions
 * (A→B and B→A) used to always lock source-then-destination, i.e. A-then-B
 * for one and B-then-A for the other — a direct deadlock shape independent
 * of line order. Locking whichever leg sorts first under the same global
 * `(warehouseId, itemId, locationId)` key used everywhere else removes the
 * direction-dependence: both transfers now agree on lock order regardless
 * of which one is "from" and which is "to".
 */
async function postTransferLegsInOrder(
  tx: Prisma.TransactionClient,
  legs: [PostStockMovementInput, PostStockMovementInput]
) {
  const ordered = legs
    .slice()
    .sort((a, b) => {
      const ka = stockLockSortKey(a);
      const kb = stockLockSortKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  for (const leg of ordered) {
    await stockMovementService.postMovementInTx(tx, leg);
  }
}

export interface TransferLine {
  itemId: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
}

export interface CreateTransferData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  date: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromCostCenterId?: string;
  toCostCenterId?: string;
  hijriDate?: string;
  lines: TransferLine[];
}

export class TransferService {
  private async assertSameBranchOrAllowed(companyId: string, fromWarehouseId: string, toWarehouseId: string) {
    const [fromWh, toWh] = await Promise.all([
      prisma.warehouse.findFirst({
        where: { id: fromWarehouseId, companyId },
        select: { branchId: true },
      }),
      prisma.warehouse.findFirst({
        where: { id: toWarehouseId, companyId },
        select: { branchId: true },
      }),
    ]);
    const fromBranch = fromWh?.branchId ?? null;
    const toBranch = toWh?.branchId ?? null;
    if (fromBranch && toBranch && fromBranch !== toBranch) {
      throw new Error('النقل بين فرعين غير مسموح. اختر مخزنين من نفس الفرع');
    }
  }

  /**
   * Create transfer entry
   */
  async createTransfer(companyId: string, data: CreateTransferData) {
    try {
      // Validate warehouses belong to company
      await assertWarehouseActive(companyId, data.fromWarehouseId, { label: 'مخزن الصرف' });
      await assertWarehouseActive(companyId, data.toWarehouseId, { label: 'مخزن الإضافة' });

      if (data.fromWarehouseId === data.toWarehouseId) {
        throw new Error('المخزن المصدر والهدف يجب أن يكونا مختلفين');
      }
      await this.assertSameBranchOrAllowed(companyId, data.fromWarehouseId, data.toWarehouseId);

      // Validate cost centers if provided
      if (data.fromCostCenterId) {
        const fromCostCenter = await prisma.costCenter.findFirst({
          where: { id: data.fromCostCenterId, companyId },
        });
        if (!fromCostCenter) {
          throw new Error('Source cost center not found or does not belong to company');
        }
      }

      if (data.toCostCenterId) {
        const toCostCenter = await prisma.costCenter.findFirst({
          where: { id: data.toCostCenterId, companyId },
        });
        if (!toCostCenter) {
          throw new Error('Destination cost center not found or does not belong to company');
        }
      }

      // Validate all items belong to company
      const itemIds = [...new Set(data.lines.map((line) => line.itemId).filter(Boolean))];
      const items = await prisma.item.findMany({
        where: {
          id: { in: itemIds },
          companyId,
        },
      });

      if (items.length !== itemIds.length) {
        throw new Error('صنف أو أكثر غير موجود أو لا يتبع الشركة');
      }

      const resolvedBranchId =
        data.branchId?.trim() ||
        (await warehouseBranchId(companyId, data.fromWarehouseId)) ||
        (await warehouseBranchId(companyId, data.toWarehouseId)) ||
        (await companyDefaultBranchId(companyId)) ||
        undefined;

      // Drafts save without stock. Posting enforces quantity.
      const transfer = await prisma.$transaction(async (tx) => {
        // Calculate total amount
        const totalAmount = data.lines.reduce(
          (sum, line) => sum + (line.total || line.quantity * (line.unitPrice || 0)),
          0
        );

        const serial = await resolveStoreDocumentSerialInTx(tx, {
          companyId,
          branchId: resolvedBranchId ?? null,
          fiscalYearId: null,
          kind: 'transfer',
          clientSerial: data.serial,
        });

        // Create transfer record
        const record = await tx.transfer.create({
          data: {
            companyId,
            branchId: resolvedBranchId || null,
            description: data.description || null,
            serial,
            date: new Date(data.date),
            hijriDate: data.hijriDate || null,
            fromWarehouseId: data.fromWarehouseId,
            toWarehouseId: data.toWarehouseId,
            fromCostCenterId: data.fromCostCenterId || null,
            toCostCenterId: data.toCostCenterId || null,
            totalAmount,
            isPosted: false,
            isApproved: false,
            isCancelled: false,
          },
        });

        const lineRows = data.lines.map((lineData) => {
          const unitPrice = lineData.unitPrice || 0;
          const total = lineData.total || lineData.quantity * unitPrice;
          return {
            transferId: record.id,
            itemId: lineData.itemId,
            fromLocationId: lineData.fromLocationId || null,
            toLocationId: lineData.toLocationId || null,
            quantity: lineData.quantity,
            unitPrice,
            total,
          };
        });
        await bulkCreateMany((args) => tx.transferLine.createMany(args), lineRows);
        const lines = await tx.transferLine.findMany({ where: { transferId: record.id } });

        return {
          ...record,
          lines,
        };
      });

      logger.info(
        {
          companyId,
          transferId: transfer.id,
          fromWarehouseId: data.fromWarehouseId,
          toWarehouseId: data.toWarehouseId,
          linesCount: data.lines.length,
        },
        'Transfer created'
      );

      return transfer;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating transfer');
      throw error;
    }
  }

  /**
   * Get transfer by ID
   */
  async getTransferById(companyId: string, transferId: string) {
    try {
      const transfer = await prisma.transfer.findFirst({
        where: {
          id: transferId,
          companyId,
        },
        include: {
          fromWarehouse: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          toWarehouse: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          fromCostCenter: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          toCostCenter: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  serial: true,
                  arabicName: true,
                  englishName: true,
                },
              },
              fromLocation: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                  englishName: true,
                },
              },
              toLocation: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                  englishName: true,
                },
              },
            },
          },
        },
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      return transfer;
    } catch (error) {
      logger.error({ error, companyId, transferId }, 'Error getting transfer');
      throw error;
    }
  }

  /**
   * Replace a draft transfer (header + lines). Posted documents must be unposted first.
   */
  async updateTransfer(companyId: string, transferId: string, data: CreateTransferData) {
    const existing = await prisma.transfer.findFirst({
      where: { id: transferId, companyId },
    });
    if (!existing) {
      throw new Error('Transfer not found');
    }
    if (existing.isPosted) {
      throw new Error('Cannot edit a posted transfer');
    }
    if (existing.isCancelled) {
      throw new Error('Cannot edit a cancelled transfer');
    }

    await assertWarehouseActive(companyId, data.fromWarehouseId, { label: 'مخزن الصرف' });
    await assertWarehouseActive(companyId, data.toWarehouseId, { label: 'مخزن الإضافة' });
    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new Error('المخزن المصدر والهدف يجب أن يكونا مختلفين');
    }
    await this.assertSameBranchOrAllowed(companyId, data.fromWarehouseId, data.toWarehouseId);

    const itemIds = [...new Set(data.lines.map((line) => line.itemId).filter(Boolean))];
    const items = await prisma.item.findMany({
      where: { id: { in: itemIds }, companyId },
    });
    if (items.length !== itemIds.length) {
      throw new Error('صنف أو أكثر غير موجود أو لا يتبع الشركة');
    }

    const totalAmount = data.lines.reduce(
      (sum, line) => sum + (line.total || line.quantity * (line.unitPrice || 0)),
      0
    );

    const resolvedBranchId =
      data.branchId?.trim() ||
      existing.branchId?.trim() ||
      (await warehouseBranchId(companyId, data.fromWarehouseId)) ||
      (await warehouseBranchId(companyId, data.toWarehouseId)) ||
      (await companyDefaultBranchId(companyId)) ||
      undefined;

    await prisma.$transaction(async (tx) => {
      await tx.transferLine.deleteMany({ where: { transferId } });
      await tx.transfer.update({
        where: { id: transferId },
        data: {
          branchId: resolvedBranchId || null,
          description: data.description || null,
          serial: data.serial || existing.serial,
          date: new Date(data.date),
          hijriDate: data.hijriDate || existing.hijriDate,
          fromWarehouseId: data.fromWarehouseId,
          toWarehouseId: data.toWarehouseId,
          fromCostCenterId: data.fromCostCenterId || null,
          toCostCenterId: data.toCostCenterId || null,
          totalAmount,
        },
      });
      const lineRows = data.lines.map((lineData) => {
        const unitPrice = lineData.unitPrice || 0;
        const total = lineData.total || lineData.quantity * unitPrice;
        return {
          transferId,
          itemId: lineData.itemId,
          fromLocationId: lineData.fromLocationId || null,
          toLocationId: lineData.toLocationId || null,
          quantity: lineData.quantity,
          unitPrice,
          total,
        };
      });
      await bulkCreateMany((args) => tx.transferLine.createMany(args), lineRows);
    });

    return this.getTransferById(companyId, transferId);
  }

  /**
   * Hard-delete an unposted transfer.
   */
  async deleteTransfer(companyId: string, transferId: string) {
    const existing = await prisma.transfer.findFirst({
      where: { id: transferId, companyId },
    });
    if (!existing) {
      throw new Error('Transfer not found');
    }
    if (existing.isPosted) {
      throw new Error('Cannot delete posted transfer. Unpost it first.');
    }

    await prisma.transfer.delete({ where: { id: transferId } });
    logger.info({ companyId, transferId }, 'Transfer deleted');
    return { success: true };
  }

  /**
   * List transfer entries
   */
  async listTransfers(
    companyId: string,
    options?: {
      branchId?: string;
      fromWarehouseId?: string;
      toWarehouseId?: string;
      isPosted?: boolean;
      isApproved?: boolean;
      isCancelled?: boolean;
      fromDate?: string;
      toDate?: string;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    try {
      const where: any = {
        companyId,
      };

      if (options?.branchId) {
        where.branchId = options.branchId;
      }

      if (options?.fromWarehouseId) {
        where.fromWarehouseId = options.fromWarehouseId;
      }

      if (options?.toWarehouseId) {
        where.toWarehouseId = options.toWarehouseId;
      }

      if (options?.isPosted !== undefined) {
        where.isPosted = options.isPosted;
      }

      if (options?.isApproved !== undefined) {
        where.isApproved = options.isApproved;
      }

      if (options?.isCancelled !== undefined) {
        where.isCancelled = options.isCancelled;
      }

      if (options?.fromDate || options?.toDate) {
        where.date = {};
        if (options.fromDate) {
          where.date.gte = new Date(options.fromDate);
        }
        if (options.toDate) {
          where.date.lte = new Date(options.toDate);
        }
      }

      if (options?.search?.trim()) {
        const q = options.search.trim();
        where.OR = [
          { serial: { contains: q } },
          { description: { contains: q } },
        ];
      }

      const [transfers, total] = await Promise.all([
        prisma.transfer.findMany({
          where,
          include: {
            fromWarehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            toWarehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
          orderBy: [{ serial: 'asc' }, { createdAt: 'asc' }],
          skip: options?.skip || 0,
          take: options?.take || 50,
        }),
        prisma.transfer.count({ where }),
      ]);

      return {
        data: transfers,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing transfers');
      throw error;
    }
  }

  /**
   * Cost history and the journal both require a real branch. A missing branch
   * used to fall through as an empty string and fail the foreign key on post.
   */
  private async resolvePostingBranch(
    companyId: string,
    transfer: { branchId: string | null; fromWarehouseId: string; toWarehouseId: string },
    glCtx?: StockGlPostingContext
  ): Promise<string> {
    const stored = transfer.branchId?.trim();
    if (stored) {
      const branch = await prisma.branch.findFirst({
        where: { id: stored, companyId, deletedAt: null },
        select: { id: true },
      });
      if (branch) return branch.id;
    }

    const fromBranch = await warehouseBranchId(companyId, transfer.fromWarehouseId);
    if (fromBranch) return fromBranch;

    const toBranch = await warehouseBranchId(companyId, transfer.toWarehouseId);
    if (toBranch) return toBranch;

    const ctxBranch = glCtx?.branchId?.trim();
    if (ctxBranch && ctxBranch !== companyId) return ctxBranch;

    const defaultBranch = await companyDefaultBranchId(companyId);
    if (defaultBranch) return defaultBranch;

    throw new AppError(
      422,
      'لا يوجد فرع مُعرَّف للشركة. من إعدادات الشركة احفظ بيانات الفرع الرئيسي ثم أعد المحاولة.'
    );
  }

  private postingContext(
    glCtx: StockGlPostingContext | undefined,
    branchId: string
  ): StockGlPostingContext | undefined {
    if (!glCtx) return undefined;
    if (glCtx.branchId && glCtx.branchId !== glCtx.companyId) return glCtx;
    return { ...glCtx, branchId };
  }

  /**
   * Post transfer (move quantities from source to destination warehouse).
   *
   * H1 fix: quantity mutations on both sides now go through
   * `stockMovementService` (row lock, `InventoryMovement` audit row,
   * negative-stock guard) instead of an unlocked read-modify-write.
   *
   * Posts stock legs at average cost, then a journal entry for the transfer
   * value (inventory credit at source / debit at destination) when GL context
   * is supplied from the API.
   */
  async postTransfer(companyId: string, transferId: string, glCtx?: StockGlPostingContext) {
    await assertStoreDocumentRight(glCtx, 'transfer', 'post');
    try {
      const transfer = await prisma.transfer.findFirst({
        where: {
          id: transferId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      if (transfer.isCancelled) {
        throw new Error('Cannot post cancelled transfer');
      }

      if (transfer.isPosted) {
        throw new Error('Transfer is already posted');
      }

      const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, transfer.date);
      await assertWarehouseActive(companyId, transfer.fromWarehouseId, { label: 'مخزن الصرف' });
      await assertWarehouseActive(companyId, transfer.toWarehouseId, { label: 'مخزن الإضافة' });

      const branchId = await this.resolvePostingBranch(companyId, transfer, glCtx);
      const glForPost = glCtx
        ? { ...this.postingContext(glCtx, branchId)!, fiscalYearId }
        : undefined;
      const sourceType = 'TRF';
      const sourceNumber = transferSourceNumber(transfer);
      const sourceYearId = String(new Date(transfer.date).getFullYear());

      const orderedTransferLines = sortForStockLocking(transfer.lines, (l) => ({
        warehouseId: transfer.fromWarehouseId,
        itemId: l.itemId,
      }));

      const inventorySystem = await ensurePerpetualInventoryGlReady(
        companyId,
        glForPost ?? glCtx,
        transfer.fromWarehouseId
      );

      let glSkipped = false;
      await prisma.$transaction(async (tx) => {
        await claimDocumentPost((args) => tx.transfer.updateMany(args), transferId, companyId);
        if (transfer.branchId !== branchId) {
          await tx.transfer.updateMany({
            where: { id: transferId, companyId },
            data: { branchId },
          });
        }
        for (const line of orderedTransferLines) {
          const qty = Number(line.quantity);
          if (qty <= 0) continue;

          await stockMovementService.lockStockRowsInTx(tx, [
            {
              companyId,
              itemId: line.itemId,
              warehouseId: transfer.fromWarehouseId,
              locationId: line.fromLocationId,
            },
            {
              companyId,
              itemId: line.itemId,
              warehouseId: transfer.toWarehouseId,
              locationId: line.toLocationId,
            },
          ]);

          const outbound = await inventoryCostingService.applyOutboundMovement(tx, {
            companyId,
            branchId,
            warehouseId: transfer.fromWarehouseId,
            itemId: line.itemId,
            locationId: line.fromLocationId,
            quantity: qty,
            movementType: COSTING_MOVEMENT.TRANSFER_OUT,
            sourceType,
            sourceNumber,
            sourceYearId,
            sourceDocumentId: transfer.id,
            transactionDate: transfer.date,
          });

          await inventoryCostingService.applyInboundMovement(tx, {
            companyId,
            branchId,
            warehouseId: transfer.toWarehouseId,
            itemId: line.itemId,
            locationId: line.toLocationId,
            quantity: qty,
            unitCost: outbound.unitCost,
            movementType: COSTING_MOVEMENT.TRANSFER_IN,
            sourceType,
            sourceNumber,
            sourceYearId,
            sourceDocumentId: transfer.id,
            transactionDate: transfer.date,
            updateLastPurchasePrice: false,
          });
        }

        // Wave 3 fix: the old code here called `costCenterMovement.create()`
        // with fields that don't exist on the model — it threw at runtime on
        // every transfer between two differing cost centers. Post a real,
        // reversible GL entry moving value between the cost centers instead.
        if (glForPost) {
          glSkipped = await runCompanyStockGlPosting(inventorySystem, async () => {
            const journal = await stockMovementGlService.postTransferValueGlInTx(tx, glForPost, {
              ...transfer,
              branchId,
            });
            if (!journal) {
              throw new AppError(
                422,
                'Inventory GL account is not configured in company settings'
              );
            }
          });
        }
      });

      const posted = await prisma.transfer.findFirst({
        where: { id: transferId, companyId },
        select: { journalEntryId: true },
      });

      if (glForPost?.userId) {
        const { documentAuditService } = await import(
          '../../accounting/services/document-audit.service'
        );
        await documentAuditService.record({
          companyId,
          entityType: 'STOCK_MOVEMENT',
          entityId: transferId,
          action: 'POSTED',
          userId: glForPost.userId,
          metadata: { documentKind: 'STOCK_TRANSFER', glSkipped },
        });
      }

      logger.info({ companyId, transferId, glSkipped }, 'Transfer posted');

      return {
        success: true,
        glSkipped,
        journalEntryId: posted?.journalEntryId ?? null,
      };
    } catch (error) {
      logger.error({ error, companyId, transferId }, 'Error posting transfer');
      throw error;
    }
  }

  /**
   * Unpost transfer (reverse quantity movements on both warehouses).
   */
  async unpostTransfer(companyId: string, transferId: string, glCtx?: StockGlPostingContext) {
    await assertStoreDocumentRight(glCtx, 'transfer', 'unpost');
    try {
      const transfer = await prisma.transfer.findFirst({
        where: {
          id: transferId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      if (!transfer.isPosted) {
        throw new Error('Transfer is not posted');
      }

      const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, transfer.date);

      const branchId = await this.resolvePostingBranch(companyId, transfer, glCtx);
      const glForPost = glCtx
        ? { ...this.postingContext(glCtx, branchId)!, fiscalYearId }
        : undefined;
      const sourceType = 'TRF';
      const sourceNumber = transferSourceNumber(transfer);
      const sourceYearId = String(new Date(transfer.date).getFullYear());

      // Use transaction to reverse movements atomically
      const orderedUnpostLines = sortForStockLocking(transfer.lines, (l) => ({
        warehouseId: transfer.fromWarehouseId,
        itemId: l.itemId,
      }));
      await prisma.$transaction(async (tx) => {
        await claimDocumentUnpost((args) => tx.transfer.updateMany(args), transferId, companyId);
        if (transfer.branchId !== branchId) {
          await tx.transfer.updateMany({
            where: { id: transferId, companyId },
            data: { branchId },
          });
        }
        for (const line of orderedUnpostLines) {
          const qty = Number(line.quantity);
          if (qty <= 0) continue;

          const originalIn = await tx.inventoryMovement.findFirst({
            where: {
              companyId,
              sourceDocumentId: transfer.id,
              itemId: line.itemId,
              warehouseId: transfer.toWarehouseId,
              quantityDelta: { gt: 0 },
            },
            orderBy: { createdAt: 'desc' },
            select: { unitCost: true },
          });
          const transferCost = Number(originalIn?.unitCost ?? line.unitPrice ?? 0);
          const legs = [
            { warehouseId: transfer.toWarehouseId, locationId: line.toLocationId, reverse: true },
            { warehouseId: transfer.fromWarehouseId, locationId: line.fromLocationId, reverse: false },
          ].sort((a, b) => (a.warehouseId < b.warehouseId ? -1 : a.warehouseId > b.warehouseId ? 1 : 0));
          for (const leg of legs) {
            if (leg.reverse) {
              await inventoryCostingService.reverseInboundInTx(tx, {
                companyId,
                branchId,
                warehouseId: leg.warehouseId,
                itemId: line.itemId,
                locationId: leg.locationId,
                quantity: qty,
                originalUnitCost: transferCost,
                movementType: COSTING_MOVEMENT.TRANSFER_OUT,
                sourceType: `${sourceType}-UNPOST`,
                sourceNumber,
                sourceYearId,
                sourceDocumentId: transfer.id,
                transactionDate: transfer.date,
                updateLastPurchasePrice: false,
              });
            } else {
              await inventoryCostingService.applyInboundMovement(tx, {
                companyId,
                branchId,
                warehouseId: leg.warehouseId,
                itemId: line.itemId,
                locationId: leg.locationId,
                quantity: qty,
                unitCost: transferCost,
                movementType: COSTING_MOVEMENT.TRANSFER_IN,
                sourceType: `${sourceType}-UNPOST`,
                sourceNumber,
                sourceYearId,
                sourceDocumentId: transfer.id,
                transactionDate: transfer.date,
                updateLastPurchasePrice: false,
              });
            }
          }
        }

        // Wave 3 fix: reverse the cost-center value-movement JE (this used
        // to be a no-op comment — the forward post never actually reversed).
        if (glForPost) {
          await stockMovementGlService.reverseBySourceInTx(
            tx,
            glForPost,
            'TRF',
            sourceNumber,
            sourceYearId,
            `Transfer ${sourceNumber} unposted`
          );
        }
      });

      logger.info({ companyId, transferId }, 'Transfer unposted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, transferId }, 'Error unposting transfer');
      throw error;
    }
  }

  /**
   * Cancel transfer
   */
  async cancelTransfer(companyId: string, transferId: string) {
    try {
      const transfer = await prisma.transfer.findFirst({
        where: {
          id: transferId,
          companyId,
        },
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      if (transfer.isCancelled) {
        throw new Error('Transfer is already cancelled');
      }

      if (transfer.isPosted) {
        throw new Error('Cannot cancel posted transfer. Unpost it first.');
      }

      await prisma.$transaction(async (tx) => {
        await journalPostingService.cascadeSourceJournalInTx(
          tx,
          companyId,
          [transfer.journalEntryId],
          'cancel',
          undefined,
          { sourceId: transfer.id, sourceType: 'TRF', sourceNumber: transferSourceNumber(transfer) }
        );
        const updateResult = await tx.transfer.updateMany({
          where: { id: transferId, companyId, version: transfer.version },
          data: {
            isCancelled: true,
            cancelledAt: new Date(),
            version: { increment: 1 },
          },
        });
        assertUpdateCount(updateResult.count);
      });

      logger.info({ companyId, transferId }, 'Transfer cancelled');

      return prisma.transfer.findFirstOrThrow({ where: { id: transferId, companyId } });
    } catch (error) {
      logger.error({ error, companyId, transferId }, 'Error cancelling transfer');
      throw error;
    }
  }

  /**
   * Restore cancelled transfer
   */
  async restoreTransfer(companyId: string, transferId: string) {
    try {
      const transfer = await prisma.transfer.findFirst({
        where: {
          id: transferId,
          companyId,
        },
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      if (!transfer.isCancelled) {
        throw new Error('Transfer is not cancelled');
      }

      const updateResult = await prisma.transfer.updateMany({
        where: { id: transferId, companyId, version: transfer.version },
        data: {
          isCancelled: false,
          cancelledAt: null,
          version: { increment: 1 },
        },
      });
      assertUpdateCount(updateResult.count);

      logger.info({ companyId, transferId }, 'Transfer restored');

      return prisma.transfer.findFirstOrThrow({ where: { id: transferId, companyId } });
    } catch (error) {
      logger.error({ error, companyId, transferId }, 'Error restoring transfer');
      throw error;
    }
  }
}

export const transferService = new TransferService();

