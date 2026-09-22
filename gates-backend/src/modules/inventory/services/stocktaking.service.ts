// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { stockMovementService } from './stock-movement.service';
import { inventoryCostingService } from './inventory-costing.service';
import { COSTING_MOVEMENT } from './inventory-costing-math';
import { stockMovementGlService, type StockGlPostingContext } from './stock-movement-gl.service';
import { assertStoreDocumentRight } from './store-document-rights';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { assertWarehouseActive } from '../utils/inventory-system';

export interface StocktakingLine {
  itemId: string;
  warehouseId: string;
  locationId?: string;
  unitId?: string;
  bookQuantity: number; // System quantity (القيمة الدفترية)
  actualQuantity: number; // Physical count (القيمة الفعلية)
  unitPrice: number;
  shortageQuantity?: number; // When actual < book (العجز)
  increaseQuantity?: number; // When actual > book (الزيادة)
  shortageTotal?: number; // Total shortage value (إجمالي العجز)
  increaseTotal?: number; // Total increase value (إجمالي الزيادة)
}

export interface CreateStocktakingData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  date: string;
  warehouseId: string;
  lines: StocktakingLine[];
}

export class StocktakingService {
  /**
   * Calculate differences from book and actual quantities
   */
  private calculateDifferences(
    bookQuantity: number,
    actualQuantity: number,
    unitPrice: number
  ): {
    shortageQuantity: number;
    increaseQuantity: number;
    shortageTotal: number;
    increaseTotal: number;
  } {
    const difference = actualQuantity - bookQuantity;
    
    let shortageQuantity = 0;
    let increaseQuantity = 0;
    
    if (difference < 0) {
      shortageQuantity = Math.abs(difference);
    } else if (difference > 0) {
      increaseQuantity = difference;
    }
    
    const shortageTotal = shortageQuantity * unitPrice;
    const increaseTotal = increaseQuantity * unitPrice;
    
    return {
      shortageQuantity,
      increaseQuantity,
      shortageTotal,
      increaseTotal,
    };
  }

  /**
   * Create stocktaking entry
   */
  async createStocktaking(companyId: string, data: CreateStocktakingData) {
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

      const warehouseBalances = await prisma.itemWarehouseBalance.findMany({
        where: {
          companyId,
          itemId: { in: itemIds },
          warehouseId: data.warehouseId,
        },
      });
      const liveBookByItem = new Map(
        warehouseBalances.map((row) => [row.itemId, Number(row.quantityOnHand) || 0])
      );

      // Use transaction to ensure atomicity
      const stocktaking = await prisma.$transaction(async (tx) => {
        // Calculate totals
        let totalShortage = 0;
        let totalIncrease = 0;

        // Process lines and calculate differences
        const processedLines = data.lines.map((line) => {
          const bookQty = line.bookQuantity || liveBookByItem.get(line.itemId) || 0;

          const differences = this.calculateDifferences(
            bookQty,
            line.actualQuantity,
            line.unitPrice
          );

          totalShortage += differences.shortageTotal;
          totalIncrease += differences.increaseTotal;

          return {
            ...line,
            bookQuantity: line.bookQuantity || bookQty,
            ...differences,
          };
        });

        // Create stocktaking record
        const record = await tx.stocktaking.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial: data.serial || null,
            date: new Date(data.date),
            warehouseId: data.warehouseId,
            totalShortage: totalShortage,
            totalIncrease: totalIncrease,
            isPosted: false,
            isApproved: false,
            isCancelled: false,
          },
        });

        // Create stocktaking lines
        const lines = [];
        for (const lineData of processedLines) {
          const line = await tx.stocktakingLine.create({
            data: {
              stocktakingId: record.id,
              itemId: lineData.itemId,
              warehouseId: lineData.warehouseId,
              locationId: lineData.locationId || null,
              unitId: lineData.unitId || null,
              bookQuantity: lineData.bookQuantity,
              actualQuantity: lineData.actualQuantity,
              unitPrice: lineData.unitPrice,
              shortageQuantity: lineData.shortageQuantity,
              increaseQuantity: lineData.increaseQuantity,
              shortageTotal: lineData.shortageTotal,
              increaseTotal: lineData.increaseTotal,
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
          stocktakingId: stocktaking.id,
          warehouseId: data.warehouseId,
          linesCount: data.lines.length,
        },
        'Stocktaking created'
      );

      return stocktaking;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating stocktaking');
      throw error;
    }
  }

  /**
   * Get stocktaking by ID
   */
  async getStocktakingById(companyId: string, stocktakingId: string) {
    try {
      const stocktaking = await prisma.stocktaking.findFirst({
        where: {
          id: stocktakingId,
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
              unit: {
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

      if (!stocktaking) {
        throw new Error('Stocktaking not found');
      }

      return stocktaking;
    } catch (error) {
      logger.error({ error, companyId, stocktakingId }, 'Error getting stocktaking');
      throw error;
    }
  }

  /**
   * List stocktaking entries
   */
  async listStocktaking(
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

      const [stocktaking, total] = await Promise.all([
        prisma.stocktaking.findMany({
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
        prisma.stocktaking.count({ where }),
      ]);

      return {
        data: stocktaking,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing stocktaking');
      throw error;
    }
  }

  /**
   * Post stocktaking (adjust item quantities based on differences).
   *
   * H1 fix: quantity mutations now go through `stockMovementService`, which
   * takes a row lock and writes an `InventoryMovement` audit row, instead of
   * an unlocked read-modify-write directly on `item_quantities`.
   *
   * C3 fix: when `glCtx` is supplied, the net shortage/surplus is posted to
   * the GL (shrinkage expense vs inventory), so the physical count is no
   * longer invisible to the ledger.
   */
  async postStocktaking(
    companyId: string,
    stocktakingId: string,
    glCtx?: StockGlPostingContext
  ) {
    await assertStoreDocumentRight(glCtx, 'stocktaking', 'post');
    try {
      const stocktaking = await prisma.stocktaking.findFirst({
        where: {
          id: stocktakingId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!stocktaking) {
        throw new Error('Stocktaking not found');
      }

      if (stocktaking.isCancelled) {
        throw new Error('Cannot post cancelled stocktaking');
      }

      if (stocktaking.isPosted) {
        throw new Error('Stocktaking is already posted');
      }

      // Once per document, never per line: the quantity leg used to skip the
      // period lock entirely, so a count dated in a closed month still moved
      // stock whenever no GL context was supplied.
      await fiscalYearService.assertOpenForDate(companyId, stocktaking.date);
      await assertWarehouseActive(companyId, stocktaking.warehouseId);

      const sourceType = 'STK';
      const sourceNumber = stocktaking.serial ?? stocktaking.id.slice(0, 8);
      const sourceYearId = String(new Date(stocktaking.date).getFullYear());

      await prisma.$transaction(async (tx) => {
        for (const line of stocktaking.lines) {
          const quantityDifference = line.actualQuantity - Number(line.bookQuantity);
          if (quantityDifference === 0) continue;

          const costingBase = {
            companyId,
            branchId: stocktaking.branchId ?? undefined,
            warehouseId: line.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId,
            sourceType,
            sourceNumber,
            sourceYearId,
            sourceDocumentId: stocktaking.id,
            transactionDate: stocktaking.date,
          };

          if (quantityDifference > 0) {
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
              quantity: quantityDifference,
              unitCost: inboundCost,
              movementType: COSTING_MOVEMENT.ADJUSTMENT_POSITIVE,
              updateLastPurchasePrice: false,
            });
          } else {
            await inventoryCostingService.applyOutboundMovement(tx, {
              ...costingBase,
              quantity: Math.abs(quantityDifference),
              movementType: COSTING_MOVEMENT.ADJUSTMENT_NEGATIVE,
            });
          }
        }

        if (glCtx) {
          await stockMovementGlService.postStocktakingVarianceGlInTx(tx, glCtx, stocktaking);
        }

        await tx.stocktaking.update({
          where: { id: stocktakingId },
          data: {
            isPosted: true,
            postedAt: new Date(),
          },
        });
      });

      logger.info({ companyId, stocktakingId }, 'Stocktaking posted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, stocktakingId }, 'Error posting stocktaking');
      throw error;
    }
  }

  /**
   * Unpost stocktaking (reverse quantity adjustments and the GL variance
   * entry via a dated contra reversal — C11-consistent, never flag-flips).
   */
  async unpostStocktaking(
    companyId: string,
    stocktakingId: string,
    glCtx?: StockGlPostingContext
  ) {
    await assertStoreDocumentRight(glCtx, 'stocktaking', 'unpost');
    try {
      const stocktaking = await prisma.stocktaking.findFirst({
        where: {
          id: stocktakingId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!stocktaking) {
        throw new Error('Stocktaking not found');
      }

      if (!stocktaking.isPosted) {
        throw new Error('Stocktaking is not posted');
      }

      await fiscalYearService.assertOpenForDate(companyId, stocktaking.date);

      const sourceType = 'STK';
      const sourceNumber = stocktaking.serial ?? stocktaking.id.slice(0, 8);
      const sourceYearId = String(new Date(stocktaking.date).getFullYear());

      await prisma.$transaction(async (tx) => {
        for (const line of stocktaking.lines) {
          const quantityDifference = line.actualQuantity - Number(line.bookQuantity);
          if (quantityDifference === 0) continue;

          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: stocktaking.branchId ?? undefined,
            warehouseId: line.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId,
            quantityDelta: -quantityDifference,
            movementType: `${sourceType}-UNPOST`,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            documentDate: stocktaking.date,
          });
        }

        if (glCtx) {
          await stockMovementGlService.reverseBySourceInTx(
            tx,
            glCtx,
            sourceType,
            sourceNumber,
            sourceYearId,
            `Stocktaking ${sourceNumber} unposted`
          );
        }

        await tx.stocktaking.update({
          where: { id: stocktakingId },
          data: {
            isPosted: false,
            postedAt: null,
          },
        });
      });

      logger.info({ companyId, stocktakingId }, 'Stocktaking unposted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, stocktakingId }, 'Error unposting stocktaking');
      throw error;
    }
  }

  /**
   * Cancel stocktaking
   */
  async cancelStocktaking(companyId: string, stocktakingId: string) {
    try {
      const stocktaking = await prisma.stocktaking.findFirst({
        where: {
          id: stocktakingId,
          companyId,
        },
      });

      if (!stocktaking) {
        throw new Error('Stocktaking not found');
      }

      if (stocktaking.isCancelled) {
        throw new Error('Stocktaking is already cancelled');
      }

      if (stocktaking.isPosted) {
        throw new Error('Cannot cancel posted stocktaking. Unpost it first.');
      }

      const updated = await prisma.stocktaking.update({
        where: { id: stocktakingId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
        },
      });

      logger.info({ companyId, stocktakingId }, 'Stocktaking cancelled');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, stocktakingId }, 'Error cancelling stocktaking');
      throw error;
    }
  }

  /**
   * Restore cancelled stocktaking
   */
  async restoreStocktaking(companyId: string, stocktakingId: string) {
    try {
      const stocktaking = await prisma.stocktaking.findFirst({
        where: {
          id: stocktakingId,
          companyId,
        },
      });

      if (!stocktaking) {
        throw new Error('Stocktaking not found');
      }

      if (!stocktaking.isCancelled) {
        throw new Error('Stocktaking is not cancelled');
      }

      const updated = await prisma.stocktaking.update({
        where: { id: stocktakingId },
        data: {
          isCancelled: false,
          cancelledAt: null,
        },
      });

      logger.info({ companyId, stocktakingId }, 'Stocktaking restored');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, stocktakingId }, 'Error restoring stocktaking');
      throw error;
    }
  }
}

export const stocktakingService = new StocktakingService();

