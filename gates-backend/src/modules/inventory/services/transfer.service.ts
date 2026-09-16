import prisma from '../../../shared/database/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '../../../shared/logger';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
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
  lines: TransferLine[];
}

export class TransferService {
  /**
   * Create transfer entry
   */
  async createTransfer(companyId: string, data: CreateTransferData) {
    try {
      // Validate warehouses belong to company
      await assertWarehouseActive(companyId, data.fromWarehouseId, { label: 'مخزن الصرف' });
      await assertWarehouseActive(companyId, data.toWarehouseId, { label: 'مخزن الإضافة' });

      if (data.fromWarehouseId === data.toWarehouseId) {
        throw new Error('Source and destination warehouses cannot be the same');
      }

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
      const itemIds = data.lines.map((line) => line.itemId);
      const items = await prisma.item.findMany({
        where: {
          id: { in: itemIds },
          companyId,
        },
      });

      if (items.length !== itemIds.length) {
        throw new Error('One or more items not found or do not belong to company');
      }

      // Check available quantities in source warehouse
      const itemQuantities = await prisma.itemQuantity.findMany({
        where: scopedItemQuantityWhere(companyId, {
          itemId: { in: itemIds },
          warehouseId: data.fromWarehouseId,
        }),
      });

      // Use transaction to ensure atomicity
      const transfer = await prisma.$transaction(async (tx) => {
        // Validate quantities are available
        for (const line of data.lines) {
          const existingQuantity = itemQuantities.find(
            (iq) =>
              iq.itemId === line.itemId &&
              iq.warehouseId === data.fromWarehouseId &&
              (iq.locationId || null) === (line.fromLocationId || null)
          );

          const availableQty = existingQuantity ? Number(existingQuantity.quantity) : 0;

          if (availableQty < line.quantity) {
            throw new Error(
              `Insufficient quantity for item ${line.itemId} in source warehouse. Available: ${availableQty}, Required: ${line.quantity}`
            );
          }
        }

        // Calculate total amount
        const totalAmount = data.lines.reduce(
          (sum, line) => sum + (line.total || line.quantity * (line.unitPrice || 0)),
          0
        );

        // Create transfer record
        const record = await tx.transfer.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial: data.serial || null,
            date: new Date(data.date),
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
   * Post transfer (move quantities from source to destination warehouse).
   *
   * H1 fix: quantity mutations on both sides now go through
   * `stockMovementService` (row lock, `InventoryMovement` audit row,
   * negative-stock guard) instead of an unlocked read-modify-write.
   *
   * C3 note: a transfer between warehouses of the same legal entity is GL
   * *value*-neutral (both sides share one company inventory control
   * account) — no journal entry is posted — but the cost ledger still needs
   * to see the movement, so both legs carry the item's current average
   * cost on the `InventoryMovement` row for audit/reconciliation.
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

      await fiscalYearService.assertOpenForDate(companyId, transfer.date);
      await assertWarehouseActive(companyId, transfer.fromWarehouseId, { label: 'مخزن الصرف' });
      await assertWarehouseActive(companyId, transfer.toWarehouseId, { label: 'مخزن الإضافة' });

      const sourceType = 'TRF';
      const sourceNumber = transfer.serial ?? transfer.id.slice(0, 8);
      const sourceYearId = String(new Date(transfer.date).getFullYear());

      const orderedTransferLines = sortForStockLocking(transfer.lines, (l) => ({
        warehouseId: transfer.fromWarehouseId,
        itemId: l.itemId,
      }));
      await prisma.$transaction(async (tx) => {
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
            branchId: transfer.branchId ?? undefined,
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
            branchId: transfer.branchId ?? undefined,
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
        if (glCtx) {
          await stockMovementGlService.postTransferValueGlInTx(tx, glCtx, transfer);
        }

        // Mark transfer as posted
        await tx.transfer.update({
          where: { id: transferId },
          data: {
            isPosted: true,
            postedAt: new Date(),
          },
        });
      });

      logger.info({ companyId, transferId }, 'Transfer posted');

      return { success: true };
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

      await fiscalYearService.assertOpenForDate(companyId, transfer.date);

      const sourceType = 'TRF';
      const sourceNumber = transfer.serial ?? transfer.id.slice(0, 8);
      const sourceYearId = String(new Date(transfer.date).getFullYear());

      // Use transaction to reverse movements atomically
      const orderedUnpostLines = sortForStockLocking(transfer.lines, (l) => ({
        warehouseId: transfer.fromWarehouseId,
        itemId: l.itemId,
      }));
      await prisma.$transaction(async (tx) => {
        for (const line of orderedUnpostLines) {
          const qty = Number(line.quantity);
          if (qty <= 0) continue;

          await postTransferLegsInOrder(tx, [
            {
              companyId,
              branchId: transfer.branchId ?? undefined,
              warehouseId: transfer.fromWarehouseId,
              itemId: line.itemId,
              locationId: line.fromLocationId,
              quantityDelta: qty,
              movementType: `${sourceType}-UNPOST`,
              sourceType: `${sourceType}-UNPOST`,
              sourceNumber,
              sourceYearId,
              documentDate: transfer.date,
            },
            {
              companyId,
              branchId: transfer.branchId ?? undefined,
              warehouseId: transfer.toWarehouseId,
              itemId: line.itemId,
              locationId: line.toLocationId,
              quantityDelta: -qty,
              movementType: `${sourceType}-UNPOST`,
              sourceType: `${sourceType}-UNPOST`,
              sourceNumber,
              sourceYearId,
              documentDate: transfer.date,
            },
          ]);
        }

        // Wave 3 fix: reverse the cost-center value-movement JE (this used
        // to be a no-op comment — the forward post never actually reversed).
        if (glCtx) {
          await stockMovementGlService.reverseBySourceInTx(
            tx,
            glCtx,
            'TRF',
            sourceNumber,
            sourceYearId,
            `Transfer ${sourceNumber} unposted`
          );
        }

        // Mark transfer as unposted
        await tx.transfer.update({
          where: { id: transferId },
          data: {
            isPosted: false,
            postedAt: null,
          },
        });
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
          { sourceId: transfer.id, sourceType: 'STK', sourceNumber: transfer.serial ?? transfer.id.slice(0, 8) }
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

