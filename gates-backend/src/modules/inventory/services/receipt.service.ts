// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { stockMovementGlService, type StockGlPostingContext } from './stock-movement-gl.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { inventoryCostingService } from './inventory-costing.service';
import { COSTING_MOVEMENT } from './inventory-costing-math';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { assertWarehouseActive } from '../utils/inventory-system';
import { assertUpdateCount } from '../../../shared/concurrency/optimistic-lock';

export interface ReceiptLine {
  itemId: string;
  locationId?: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
}

export interface CreateReceiptData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  date: string;
  hijriDate?: string;
  record?: string;
  warehouseId: string;
  lines: ReceiptLine[];
}

export class ReceiptService {
  /**
   * Create receipt entry
   */
  async createReceipt(companyId: string, data: CreateReceiptData) {
    try {
      // Validate warehouse belongs to company
      await assertWarehouseActive(companyId, data.warehouseId);

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

      // Validate locations if provided
      const locationIds = data.lines
        .map((line) => line.locationId)
        .filter((id): id is string => !!id);

      if (locationIds.length > 0) {
        const locations = await prisma.location.findMany({
          where: {
            id: { in: locationIds },
            warehouseId: data.warehouseId,
          },
        });

        if (locations.length !== locationIds.length) {
          throw new Error('One or more locations not found or do not belong to warehouse');
        }
      }

      // Use transaction to ensure atomicity
      const receipt = await prisma.$transaction(async (tx) => {
        // Calculate total amount
        const totalAmount = data.lines.reduce(
          (sum, line) => sum + (line.total || line.quantity * (line.unitPrice || 0)),
          0
        );

        // Create receipt record
        const record = await tx.receipt.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial: data.serial || null,
            date: new Date(data.date),
            hijriDate: data.hijriDate || null,
            record: data.record || null,
            warehouseId: data.warehouseId,
            totalAmount,
            isPosted: false,
            isApproved: false,
            isCancelled: false,
          },
        });

        // Create receipt lines
        const lines = [];
        for (const lineData of data.lines) {
          const unitPrice = lineData.unitPrice || 0;
          const total = lineData.total || lineData.quantity * unitPrice;

          const line = await tx.receiptLine.create({
            data: {
              receiptId: record.id,
              itemId: lineData.itemId,
              locationId: lineData.locationId || null,
              quantity: lineData.quantity,
              unitPrice,
              total,
            },
          });
          lines.push(line);
        }

        return {
          ...record,
          lines,
        };
      });

      logger.info(
        {
          companyId,
          receiptId: receipt.id,
          warehouseId: data.warehouseId,
          linesCount: data.lines.length,
        },
        'Receipt created'
      );

      return receipt;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating receipt');
      throw error;
    }
  }

  /**
   * Get receipt by ID
   */
  async getReceiptById(companyId: string, receiptId: string) {
    try {
      const receipt = await prisma.receipt.findFirst({
        where: {
          id: receiptId,
          companyId,
        },
        include: {
          warehouse: {
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
                  code: true,
                  serial: true,
                  arabicName: true,
                  englishName: true,
                },
              },
              location: {
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

      if (!receipt) {
        throw new Error('Receipt not found');
      }

      return receipt;
    } catch (error) {
      logger.error({ error, companyId, receiptId }, 'Error getting receipt');
      throw error;
    }
  }

  /**
   * List receipt entries
   */
  async listReceipts(
    companyId: string,
    options?: {
      branchId?: string;
      warehouseId?: string;
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

      if (options?.warehouseId) {
        where.warehouseId = options.warehouseId;
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

      const [receipts, total] = await Promise.all([
        prisma.receipt.findMany({
          where,
          include: {
            warehouse: {
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
        prisma.receipt.count({ where }),
      ]);

      return {
        data: receipts,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing receipts');
      throw error;
    }
  }

  /**
   * Post receipt (add quantities to warehouse)
   */
  async postReceipt(
    companyId: string,
    receiptId: string,
    glCtx?: StockGlPostingContext
  ) {
    try {
      const receipt = await prisma.receipt.findFirst({
        where: {
          id: receiptId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!receipt) {
        throw new Error('Receipt not found');
      }

      if (receipt.isCancelled) {
        throw new Error('Cannot post cancelled receipt');
      }

      if (receipt.isPosted) {
        throw new Error('Receipt is already posted');
      }

      await assertWarehouseActive(companyId, receipt.warehouseId);

      // Route quantity + MAC through inventoryCostingService (stock ledger,
      // warehouse average, and item valuation stay on one path).
      const sourceType = 'GR';
      const sourceNumber = receipt.serial ?? receipt.id.slice(0, 8);
      const sourceYearId = String(new Date(receipt.date).getFullYear());

      await prisma.$transaction(async (tx) => {
        for (const line of receipt.lines) {
          const specified = line.unitPrice != null ? Number(line.unitPrice) : 0;
          const item = specified
            ? null
            : await tx.item.findFirst({
                where: { id: line.itemId, companyId },
                select: { averageCost: true },
              });
          const inboundCost = specified || Number(item?.averageCost ?? 0);
          await inventoryCostingService.applyInboundMovement(tx, {
            companyId,
            branchId: receipt.branchId ?? undefined,
            warehouseId: receipt.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            quantity: Number(line.quantity),
            unitCost: inboundCost,
            movementType: COSTING_MOVEMENT.PURCHASE,
            sourceType,
            sourceNumber,
            sourceYearId,
            sourceDocumentId: receipt.id,
            transactionDate: receipt.date,
            hijriDate: receipt.hijriDate ?? undefined,
            updateLastPurchasePrice: specified > 0,
          });
        }

        if (glCtx) {
          await stockMovementGlService.postGoodsReceiptGlInTx(tx, glCtx, receipt);
        }

        // Mark receipt as posted
        await tx.receipt.update({
          where: { id: receiptId },
          data: {
            isPosted: true,
            postedAt: new Date(),
          },
        });
      });

      logger.info({ companyId, receiptId }, 'Receipt posted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, receiptId }, 'Error posting receipt');
      throw error;
    }
  }

  /**
   * Unpost receipt (reverse quantity additions)
   */
  async unpostReceipt(companyId: string, receiptId: string, glCtx?: StockGlPostingContext) {
    try {
      const receipt = await prisma.receipt.findFirst({
        where: {
          id: receiptId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!receipt) {
        throw new Error('Receipt not found');
      }

      if (!receipt.isPosted) {
        throw new Error('Receipt is not posted');
      }

      const sourceType = 'GR';
      const sourceNumber = receipt.serial ?? receipt.id.slice(0, 8);
      const sourceYearId = String(new Date(receipt.date).getFullYear());

      // Use transaction to reverse movements atomically
      await prisma.$transaction(async (tx) => {
        for (const line of receipt.lines) {
          await inventoryCostingService.applyOutboundMovement(tx, {
            companyId,
            branchId: receipt.branchId ?? undefined,
            warehouseId: receipt.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            quantity: Number(line.quantity),
            movementType: COSTING_MOVEMENT.RETURN_PURCHASE,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            sourceDocumentId: receipt.id,
            transactionDate: receipt.date,
          });
        }

        if (glCtx) {
          await stockMovementGlService.reverseBySourceInTx(
            tx,
            glCtx,
            sourceType,
            sourceNumber,
            sourceYearId,
            `Receipt ${sourceNumber} unposted`
          );
        }

        // Mark receipt as unposted
        await tx.receipt.update({
          where: { id: receiptId },
          data: {
            isPosted: false,
            postedAt: null,
          },
        });
      });

      logger.info({ companyId, receiptId }, 'Receipt unposted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, receiptId }, 'Error unposting receipt');
      throw error;
    }
  }

  /**
   * Cancel receipt
   */
  async cancelReceipt(companyId: string, receiptId: string) {
    try {
      const receipt = await prisma.receipt.findFirst({
        where: {
          id: receiptId,
          companyId,
        },
      });

      if (!receipt) {
        throw new Error('Receipt not found');
      }

      if (receipt.isCancelled) {
        throw new Error('Receipt is already cancelled');
      }

      if (receipt.isPosted) {
        throw new Error('Cannot cancel posted receipt. Unpost it first.');
      }

      await prisma.$transaction(async (tx) => {
        await journalPostingService.cascadeSourceJournalInTx(
          tx,
          companyId,
          [receipt.journalEntryId],
          'cancel',
          undefined,
          { sourceId: receipt.id, sourceType: 'GR', sourceNumber: receipt.serial ?? receipt.id.slice(0, 8) }
        );
        const updateResult = await tx.receipt.updateMany({
          where: { id: receiptId, companyId, version: receipt.version },
          data: {
            isCancelled: true,
            cancelledAt: new Date(),
            version: { increment: 1 },
          },
        });
        assertUpdateCount(updateResult.count);
      });

      logger.info({ companyId, receiptId }, 'Receipt cancelled');

      return prisma.receipt.findFirstOrThrow({ where: { id: receiptId, companyId } });
    } catch (error) {
      logger.error({ error, companyId, receiptId }, 'Error cancelling receipt');
      throw error;
    }
  }

  /**
   * Restore cancelled receipt
   */
  async restoreReceipt(companyId: string, receiptId: string) {
    try {
      const receipt = await prisma.receipt.findFirst({
        where: {
          id: receiptId,
          companyId,
        },
      });

      if (!receipt) {
        throw new Error('Receipt not found');
      }

      if (!receipt.isCancelled) {
        throw new Error('Receipt is not cancelled');
      }

      const updateResult = await prisma.receipt.updateMany({
        where: { id: receiptId, companyId, version: receipt.version },
        data: {
          isCancelled: false,
          cancelledAt: null,
          version: { increment: 1 },
        },
      });
      assertUpdateCount(updateResult.count);

      logger.info({ companyId, receiptId }, 'Receipt restored');

      return prisma.receipt.findFirstOrThrow({ where: { id: receiptId, companyId } });
    } catch (error) {
      logger.error({ error, companyId, receiptId }, 'Error restoring receipt');
      throw error;
    }
  }
}

export const receiptService = new ReceiptService();

