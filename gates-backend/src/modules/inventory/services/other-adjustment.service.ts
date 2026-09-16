import prisma from '../../../shared/database/prisma';
import { Prisma } from '@prisma/client';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { logger } from '../../../shared/logger';
import { stockMovementService } from './stock-movement.service';
import { stockMovementGlService, type StockGlPostingContext } from './stock-movement-gl.service';
import { assertStoreDocumentRight } from './store-document-rights';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { assertWarehouseActive } from '../utils/inventory-system';

export interface OtherAdjustmentSource {
  source: string; // Source name (المصدر)
  percentage: number; // Percentage (النسبة %)
}

export interface OtherAdjustmentLine {
  itemId: string;
  locationId?: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
  adjustmentType: 'addition' | 'discount'; // Type of adjustment
  sources?: OtherAdjustmentSource[]; // Sources with percentages
}

export interface CreateOtherAdjustmentData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  date: string;
  warehouseId: string;
  lines: OtherAdjustmentLine[];
}

export class OtherAdjustmentService {
  /**
   * Create other adjustment entry (additions/discounts from various sources)
   */
  async createOtherAdjustment(companyId: string, data: CreateOtherAdjustmentData) {
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

      // Get current quantities to validate for discounts
      const itemQuantities = await prisma.itemQuantity.findMany({
        where: scopedItemQuantityWhere(companyId, {
          itemId: { in: itemIds },
          warehouseId: data.warehouseId,
        }),
      });

      // Use transaction to ensure atomicity
      const adjustment = await prisma.$transaction(async (tx) => {
        // Validate quantities for discount lines
        for (const line of data.lines) {
          if (line.adjustmentType === 'discount') {
            const existingQuantity = itemQuantities.find(
              (iq) =>
                iq.itemId === line.itemId &&
                iq.warehouseId === data.warehouseId &&
                (iq.locationId || null) === (line.locationId || null)
            );

            const availableQty = existingQuantity ? Number(existingQuantity.quantity) : 0;

            if (availableQty < line.quantity) {
              throw new Error(
                `Insufficient quantity for discount on item ${line.itemId}. Available: ${availableQty}, Required: ${line.quantity}`
              );
            }
          }
        }

        // Calculate total amounts
        const totalAmount = data.lines.reduce(
          (sum, line) => sum + (line.total || line.quantity * (line.unitPrice || 0)),
          0
        );

        // Create other adjustment record
        const record = await tx.otherAdjustment.create({
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
          const unitPrice = lineData.unitPrice || 0;
          const total = lineData.total || lineData.quantity * unitPrice;

          const line = await tx.otherAdjustmentLine.create({
            data: {
              otherAdjustmentId: record.id,
              itemId: lineData.itemId,
              locationId: lineData.locationId || null,
              quantity: lineData.quantity,
              adjustmentType: lineData.adjustmentType,
              unitPrice,
              total,
            },
          });

          // Create source lines if provided
          if (lineData.sources && lineData.sources.length > 0) {
            for (const sourceData of lineData.sources) {
              await tx.otherAdjustmentSource.create({
                data: {
                  otherAdjustmentLineId: line.id,
                  source: sourceData.source,
                  percentage: sourceData.percentage,
                },
              });
            }
          }

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
        'Other adjustment created'
      );

      return adjustment;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating other adjustment');
      throw error;
    }
  }

  /**
   * Get other adjustment by ID
   */
  async getOtherAdjustmentById(companyId: string, adjustmentId: string) {
    try {
      const adjustment = await prisma.otherAdjustment.findFirst({
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
              sources: true,
            },
          },
        },
      });

      if (!adjustment) {
        throw new Error('Other adjustment not found');
      }

      return adjustment;
    } catch (error) {
      logger.error({ error, companyId, adjustmentId }, 'Error getting other adjustment');
      throw error;
    }
  }

  /**
   * List other adjustment entries
   */
  async listOtherAdjustments(
    companyId: string,
    options?: {
      branchId?: string;
      warehouseId?: string;
      adjustmentType?: 'addition' | 'discount';
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
      const where: Prisma.OtherAdjustmentWhereInput = {
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
        const dateFilter: Prisma.DateTimeFilter = {};
        if (options.fromDate) {
          dateFilter.gte = new Date(options.fromDate);
        }
        if (options.toDate) {
          dateFilter.lte = new Date(options.toDate);
        }
        where.date = dateFilter;
      }

      const [adjustments, total] = await Promise.all([
        prisma.otherAdjustment.findMany({
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
        prisma.otherAdjustment.count({ where }),
      ]);

      // Filter by adjustment type if specified (needs to be done post-query since it's on the line)
      let filteredData = adjustments;
      if (options?.adjustmentType) {
        filteredData = adjustments.filter((adj) =>
          adj.lines.some((line) => line.adjustmentType === options.adjustmentType)
        );
      }

      return {
        data: filteredData,
        total: filteredData.length,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing other adjustments');
      throw error;
    }
  }

  /**
   * Post other adjustment (apply quantity changes)
   */
  async postOtherAdjustment(
    companyId: string,
    adjustmentId: string,
    glCtx?: StockGlPostingContext
  ) {
    await assertStoreDocumentRight(glCtx, 'adjustment', 'post');
    try {
      const adjustment = await prisma.otherAdjustment.findFirst({
        where: {
          id: adjustmentId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!adjustment) {
        throw new Error('Other adjustment not found');
      }

      if (adjustment.isCancelled) {
        throw new Error('Cannot post cancelled other adjustment');
      }

      if (adjustment.isPosted) {
        throw new Error('Other adjustment is already posted');
      }

      await fiscalYearService.assertOpenForDate(companyId, adjustment.date);
      await assertWarehouseActive(companyId, adjustment.warehouseId);

      // Wave 3 fix: route through `stockMovementService.postMovementInTx` so
      // each line takes a row lock (via a companyId/item/warehouse-scoped
      // `FOR UPDATE`) and asserts against negative stock atomically, instead
      // of the previous read-then-write-outside-a-lock race where two
      // concurrent posts of overlapping discount lines could both read the
      // same "sufficient" quantity and then both decrement past zero. Also
      // now writes an `InventoryMovement` audit row per line like every
      // other stock-affecting document type.
      const sourceType = 'OADJ';
      const sourceNumber = adjustment.serial ?? adjustment.id.slice(0, 8);
      const sourceYearId = String(new Date(adjustment.date).getFullYear());

      await prisma.$transaction(async (tx) => {
        for (const line of adjustment.lines) {
          const qty = Number(line.quantity);
          if (qty === 0) continue;
          const delta = line.adjustmentType === 'addition' ? qty : -qty;

          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: adjustment.branchId ?? undefined,
            warehouseId: adjustment.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId,
            quantityDelta: delta,
            unitCost: line.unitPrice != null ? Number(line.unitPrice) : undefined,
            movementType: sourceType,
            sourceType,
            sourceNumber,
            sourceYearId,
            documentDate: adjustment.date,
          });
        }

        if (glCtx) {
          await stockMovementGlService.postOtherAdjustmentGlInTx(tx, glCtx, adjustment);
        }

        // Mark adjustment as posted
        await tx.otherAdjustment.update({
          where: { id: adjustmentId },
          data: {
            isPosted: true,
            postedAt: new Date(),
          },
        });
      });

      logger.info({ companyId, adjustmentId }, 'Other adjustment posted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, adjustmentId }, 'Error posting other adjustment');
      throw error;
    }
  }

  /**
   * Unpost other adjustment (reverse quantity changes)
   */
  async unpostOtherAdjustment(
    companyId: string,
    adjustmentId: string,
    glCtx?: StockGlPostingContext
  ) {
    await assertStoreDocumentRight(glCtx, 'adjustment', 'unpost');
    try {
      const adjustment = await prisma.otherAdjustment.findFirst({
        where: {
          id: adjustmentId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!adjustment) {
        throw new Error('Other adjustment not found');
      }

      if (!adjustment.isPosted) {
        throw new Error('Other adjustment is not posted');
      }

      await fiscalYearService.assertOpenForDate(companyId, adjustment.date);

      const sourceType = 'OADJ';
      const sourceNumber = adjustment.serial ?? adjustment.id.slice(0, 8);
      const sourceYearId = String(new Date(adjustment.date).getFullYear());

      await prisma.$transaction(async (tx) => {
        for (const line of adjustment.lines) {
          const qty = Number(line.quantity);
          if (qty === 0) continue;
          // Reverse of the original delta applied in `postOtherAdjustment`.
          const delta = line.adjustmentType === 'addition' ? -qty : qty;

          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: adjustment.branchId ?? undefined,
            warehouseId: adjustment.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId,
            quantityDelta: delta,
            movementType: `${sourceType}-UNPOST`,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            documentDate: adjustment.date,
          });
        }

        if (glCtx) {
          await stockMovementGlService.reverseBySourceInTx(
            tx,
            glCtx,
            sourceType,
            sourceNumber,
            sourceYearId,
            `Unpost other adjustment ${sourceNumber}`
          );
        }

        // Mark adjustment as unposted
        await tx.otherAdjustment.update({
          where: { id: adjustmentId },
          data: {
            isPosted: false,
            postedAt: null,
          },
        });
      });

      logger.info({ companyId, adjustmentId }, 'Other adjustment unposted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, adjustmentId }, 'Error unposting other adjustment');
      throw error;
    }
  }

  /**
   * Cancel other adjustment
   */
  async cancelOtherAdjustment(companyId: string, adjustmentId: string) {
    try {
      const adjustment = await prisma.otherAdjustment.findFirst({
        where: {
          id: adjustmentId,
          companyId,
        },
      });

      if (!adjustment) {
        throw new Error('Other adjustment not found');
      }

      if (adjustment.isCancelled) {
        throw new Error('Other adjustment is already cancelled');
      }

      if (adjustment.isPosted) {
        throw new Error('Cannot cancel posted other adjustment. Unpost it first.');
      }

      const updated = await prisma.otherAdjustment.update({
        where: { id: adjustmentId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
        },
      });

      logger.info({ companyId, adjustmentId }, 'Other adjustment cancelled');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, adjustmentId }, 'Error cancelling other adjustment');
      throw error;
    }
  }

  /**
   * Restore cancelled other adjustment
   */
  async restoreOtherAdjustment(companyId: string, adjustmentId: string) {
    try {
      const adjustment = await prisma.otherAdjustment.findFirst({
        where: {
          id: adjustmentId,
          companyId,
        },
      });

      if (!adjustment) {
        throw new Error('Other adjustment not found');
      }

      if (!adjustment.isCancelled) {
        throw new Error('Other adjustment is not cancelled');
      }

      const updated = await prisma.otherAdjustment.update({
        where: { id: adjustmentId },
        data: {
          isCancelled: false,
          cancelledAt: null,
        },
      });

      logger.info({ companyId, adjustmentId }, 'Other adjustment restored');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, adjustmentId }, 'Error restoring other adjustment');
      throw error;
    }
  }
}

export const otherAdjustmentService = new OtherAdjustmentService();

