// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { logger } from '../../../shared/logger';
import { inventoryCostingService } from './inventory-costing.service';
import { COSTING_MOVEMENT } from './inventory-costing-math';
import { stockMovementGlService, type StockGlPostingContext } from './stock-movement-gl.service';
import { assertStoreDocumentRight } from './store-document-rights';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { assertUpdateCount } from '../../../shared/concurrency/optimistic-lock';

export interface AdjustmentLine {
  itemId: string;
  locationId?: string;
  bookQuantity: number; // Current system quantity (القيمة الدفترية)
  actualQuantity: number; // Desired quantity after adjustment (القيمة الفعلية)
  unitPrice?: number;
  adjustmentQuantity?: number; // Calculated: actualQuantity - bookQuantity (positive = increase, negative = decrease)
  adjustmentTotal?: number; // Calculated: adjustmentQuantity * unitPrice
}

export interface CreateAdjustmentData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  date: string;
  warehouseId: string;
  lines: AdjustmentLine[];
}

export class AdjustmentService {
  /**
   * Calculate adjustment differences
   */
  private calculateAdjustment(
    bookQuantity: number,
    actualQuantity: number,
    unitPrice: number
  ): {
    adjustmentQuantity: number;
    adjustmentTotal: number;
  } {
    const adjustmentQuantity = actualQuantity - bookQuantity;
    const adjustmentTotal = adjustmentQuantity * unitPrice;

    return { adjustmentQuantity, adjustmentTotal };
  }

  /**
   * Create adjustment entry
   */
  async createAdjustment(companyId: string, data: CreateAdjustmentData) {
    try {
      // Validate warehouse belongs to company
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: data.warehouseId, companyId },
      });

      if (!warehouse) {
        throw new Error('Warehouse not found or does not belong to company');
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

      // Get current quantities to populate book quantities
      const itemQuantities = await prisma.itemQuantity.findMany({
        where: scopedItemQuantityWhere(companyId, {
          itemId: { in: itemIds },
          warehouseId: data.warehouseId,
        }),
      });

      // Use transaction to ensure atomicity
      const adjustment = await prisma.$transaction(async (tx) => {
        // Calculate totals and adjustments
        let totalAmount = 0;

        // Process each line to calculate adjustments
        for (const lineData of data.lines) {
          // Get current book quantity from system if not provided
          let bookQty = lineData.bookQuantity;
          if (!bookQty) {
            const existingQuantity = itemQuantities.find(
              (iq) =>
                iq.itemId === lineData.itemId &&
                iq.warehouseId === data.warehouseId &&
                (iq.locationId || null) === (lineData.locationId || null)
            );
            bookQty = existingQuantity ? Number(existingQuantity.quantity) : 0;
          }

          const unitPrice = lineData.unitPrice || 0;
          const { adjustmentQuantity, adjustmentTotal } = this.calculateAdjustment(
            bookQty,
            lineData.actualQuantity,
            unitPrice
          );

          totalAmount += Math.abs(adjustmentTotal);
        }

        // Create adjustment record
        const record = await tx.adjustment.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial: data.serial || null,
            date: new Date(data.date),
            warehouseId: data.warehouseId,
            totalAmount,
            isPosted: false,
            isApproved: false,
            isCancelled: false,
          },
        });

        // Create adjustment lines
        const lines = [];
        for (const lineData of data.lines) {
          // Get current book quantity from system if not provided
          let bookQty = lineData.bookQuantity;
          if (!bookQty) {
            const existingQuantity = itemQuantities.find(
              (iq) =>
                iq.itemId === lineData.itemId &&
                iq.warehouseId === data.warehouseId &&
                (iq.locationId || null) === (lineData.locationId || null)
            );
            bookQty = existingQuantity ? Number(existingQuantity.quantity) : 0;
          }

          const unitPrice = lineData.unitPrice || 0;
          const { adjustmentQuantity, adjustmentTotal } = this.calculateAdjustment(
            bookQty,
            lineData.actualQuantity,
            unitPrice
          );

          const line = await tx.adjustmentLine.create({
            data: {
              adjustmentId: record.id,
              itemId: lineData.itemId,
              locationId: lineData.locationId || null,
              bookQuantity: bookQty,
              actualQuantity: lineData.actualQuantity,
              adjustmentQuantity,
              unitPrice,
              adjustmentTotal,
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
          adjustmentId: adjustment.id,
          warehouseId: data.warehouseId,
          linesCount: data.lines.length,
        },
        'Adjustment created'
      );

      return adjustment;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating adjustment');
      throw error;
    }
  }

  /**
   * Get adjustment by ID
   */
  async getAdjustmentById(companyId: string, adjustmentId: string) {
    try {
      const adjustment = await prisma.adjustment.findFirst({
        where: {
          id: adjustmentId,
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

      if (!adjustment) {
        throw new Error('Adjustment not found');
      }

      return adjustment;
    } catch (error) {
      logger.error({ error, companyId, adjustmentId }, 'Error getting adjustment');
      throw error;
    }
  }

  /**
   * List adjustment entries
   */
  async listAdjustments(
    companyId: string,
    options?: {
      branchId?: string;
      warehouseId?: string;
      isPosted?: boolean;
      isApproved?: boolean;
      isCancelled?: boolean;
      fromDate?: string;
      toDate?: string;
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

      const [adjustments, total] = await Promise.all([
        prisma.adjustment.findMany({
          where,
          include: {
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
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
                  },
                },
              },
              take: 5, // Limit lines in list view
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: options?.skip || 0,
          take: options?.take || 50,
        }),
        prisma.adjustment.count({ where }),
      ]);

      return {
        data: adjustments,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing adjustments');
      throw error;
    }
  }

  /**
   * Post adjustment (apply quantity adjustments).
   *
   * Routes through inventoryCostingService: surplus averages in at the
   * adjustment valuation cost; shortage consumes current warehouse MAC so
   * the GL variance matches the inventory relief. C3 still posts the net
   * increase/decrease when `glCtx` is supplied.
   */
  async postAdjustment(
    companyId: string,
    adjustmentId: string,
    glCtx?: StockGlPostingContext
  ) {
    await assertStoreDocumentRight(glCtx, 'adjustment', 'post');
    try {
      const adjustment = await prisma.adjustment.findFirst({
        where: {
          id: adjustmentId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!adjustment) {
        throw new Error('Adjustment not found');
      }

      if (adjustment.isCancelled) {
        throw new Error('Cannot post cancelled adjustment');
      }

      if (adjustment.isPosted) {
        throw new Error('Adjustment is already posted');
      }

      await fiscalYearService.assertOpenForDate(companyId, adjustment.date);

      const sourceType = 'ADJ';
      const sourceNumber = adjustment.serial ?? adjustment.id.slice(0, 8);
      const sourceYearId = String(new Date(adjustment.date).getFullYear());

      await prisma.$transaction(async (tx) => {
        for (const line of adjustment.lines) {
          const qty = Number(line.adjustmentQuantity);
          if (qty === 0) continue;

          const costingBase = {
            companyId,
            branchId: adjustment.branchId ?? undefined,
            warehouseId: adjustment.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId,
            sourceType,
            sourceNumber,
            sourceYearId,
            sourceDocumentId: adjustment.id,
            transactionDate: adjustment.date,
          };

          if (qty > 0) {
            const specified = line.unitPrice != null ? Number(line.unitPrice) : 0;
            const item = specified
              ? null
              : await tx.item.findFirst({
                  where: { id: line.itemId, companyId },
                  select: { lastPurchasePrice: true, averageCost: true },
                });
            const inboundCost =
              specified ||
              Number(item?.lastPurchasePrice ?? 0) ||
              Number(item?.averageCost ?? 0);
            await inventoryCostingService.applyInboundMovement(tx, {
              ...costingBase,
              quantity: qty,
              unitCost: inboundCost,
              movementType: COSTING_MOVEMENT.ADJUSTMENT_POSITIVE,
              updateLastPurchasePrice: false,
            });
          } else {
            await inventoryCostingService.applyOutboundMovement(tx, {
              ...costingBase,
              quantity: Math.abs(qty),
              movementType: COSTING_MOVEMENT.ADJUSTMENT_NEGATIVE,
            });
          }
        }

        if (glCtx) {
          await stockMovementGlService.postAdjustmentVarianceGlInTx(tx, glCtx, adjustment);
        }

        await tx.adjustment.update({
          where: { id: adjustmentId },
          data: {
            isPosted: true,
            postedAt: new Date(),
          },
        });
      });

      logger.info({ companyId, adjustmentId }, 'Adjustment posted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, adjustmentId }, 'Error posting adjustment');
      throw error;
    }
  }

  /**
   * Unpost adjustment — reverses both the quantities and the GL variance
   * entry via a dated contra reversal (C11-consistent).
   */
  async unpostAdjustment(
    companyId: string,
    adjustmentId: string,
    glCtx?: StockGlPostingContext
  ) {
    await assertStoreDocumentRight(glCtx, 'adjustment', 'unpost');
    try {
      const adjustment = await prisma.adjustment.findFirst({
        where: {
          id: adjustmentId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!adjustment) {
        throw new Error('Adjustment not found');
      }

      if (!adjustment.isPosted) {
        throw new Error('Adjustment is not posted');
      }

      await fiscalYearService.assertOpenForDate(companyId, adjustment.date);

      const sourceType = 'ADJ';
      const sourceNumber = adjustment.serial ?? adjustment.id.slice(0, 8);
      const sourceYearId = String(new Date(adjustment.date).getFullYear());

      await prisma.$transaction(async (tx) => {
        for (const line of adjustment.lines) {
          const qty = Number(line.adjustmentQuantity);
          if (qty === 0) continue;

          const costingBase = {
            companyId,
            branchId: adjustment.branchId ?? undefined,
            warehouseId: adjustment.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            sourceDocumentId: adjustment.id,
            transactionDate: adjustment.date,
          };

          if (qty > 0) {
            await inventoryCostingService.applyOutboundMovement(tx, {
              ...costingBase,
              quantity: qty,
              movementType: COSTING_MOVEMENT.ADJUSTMENT_NEGATIVE,
            });
          } else {
            await inventoryCostingService.applyInboundMovement(tx, {
              ...costingBase,
              quantity: Math.abs(qty),
              inheritCurrentCost: true,
              updateLastPurchasePrice: false,
              movementType: COSTING_MOVEMENT.ADJUSTMENT_POSITIVE,
            });
          }
        }

        if (glCtx) {
          await stockMovementGlService.reverseBySourceInTx(
            tx,
            glCtx,
            sourceType,
            sourceNumber,
            sourceYearId,
            `Adjustment ${sourceNumber} unposted`
          );
        }

        await tx.adjustment.update({
          where: { id: adjustmentId },
          data: {
            isPosted: false,
            postedAt: null,
          },
        });
      });

      logger.info({ companyId, adjustmentId }, 'Adjustment unposted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, adjustmentId }, 'Error unposting adjustment');
      throw error;
    }
  }

  /**
   * Cancel adjustment
   */
  async cancelAdjustment(companyId: string, adjustmentId: string) {
    try {
      const adjustment = await prisma.adjustment.findFirst({
        where: {
          id: adjustmentId,
          companyId,
        },
      });

      if (!adjustment) {
        throw new Error('Adjustment not found');
      }

      if (adjustment.isCancelled) {
        throw new Error('Adjustment is already cancelled');
      }

      if (adjustment.isPosted) {
        throw new Error('Cannot cancel posted adjustment. Unpost it first.');
      }

      const updateResult = await prisma.adjustment.updateMany({
        where: { id: adjustmentId, companyId, version: adjustment.version },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
      });
      assertUpdateCount(updateResult.count);

      logger.info({ companyId, adjustmentId }, 'Adjustment cancelled');

      return prisma.adjustment.findFirstOrThrow({ where: { id: adjustmentId, companyId } });
    } catch (error) {
      logger.error({ error, companyId, adjustmentId }, 'Error cancelling adjustment');
      throw error;
    }
  }

  /**
   * Restore cancelled adjustment
   */
  async restoreAdjustment(companyId: string, adjustmentId: string) {
    try {
      const adjustment = await prisma.adjustment.findFirst({
        where: {
          id: adjustmentId,
          companyId,
        },
      });

      if (!adjustment) {
        throw new Error('Adjustment not found');
      }

      if (!adjustment.isCancelled) {
        throw new Error('Adjustment is not cancelled');
      }

      const updateResult = await prisma.adjustment.updateMany({
        where: { id: adjustmentId, companyId, version: adjustment.version },
        data: {
          isCancelled: false,
          cancelledAt: null,
          version: { increment: 1 },
        },
      });
      assertUpdateCount(updateResult.count);

      logger.info({ companyId, adjustmentId }, 'Adjustment restored');

      return prisma.adjustment.findFirstOrThrow({ where: { id: adjustmentId, companyId } });
    } catch (error) {
      logger.error({ error, companyId, adjustmentId }, 'Error restoring adjustment');
      throw error;
    }
  }
}

export const adjustmentService = new AdjustmentService();

