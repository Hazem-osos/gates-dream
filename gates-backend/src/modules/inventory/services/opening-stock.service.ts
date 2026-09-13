// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { stockMovementService } from './stock-movement.service';
import { itemCostService } from './item-cost.service';
import { inventoryCostingService } from './inventory-costing.service';
import { COSTING_MOVEMENT } from './inventory-costing-math';
import {
  resolveStockGlAccounts,
  stockMovementGlService,
  type StockGlPostingContext,
} from './stock-movement-gl.service';
import { assertStoreDocumentRight } from './store-document-rights';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';

const SOURCE_TYPE = 'OB';

export interface OpeningStockLine {
  itemId: string;
  warehouseId: string;
  locationId?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CreateOpeningStockData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  date: string;
  lines: OpeningStockLine[];
}

export class OpeningStockService {
  /**
   * Groups line values by each item's own GL control account (mirroring
   * `mainAccountId` usage in assembly/disassembly/landed-cost) and posts a
   * single balanced entry: debit each inventory account for its share,
   * credit the company's stock-adjustment/suspense account as the offset
   * (the accountant reclasses that to opening-balance equity separately,
   * same pattern goods receipt already uses for its "other side").
   *
   * Inventory-truth fix: previously opening stock only ever wrote
   * `item_quantities` + (now) `ItemCostHistory` — it never touched the GL,
   * so the inventory control account could never reconcile to the stock
   * ledger for any company with historical opening balances.
   */
  private async postOpeningBalanceGlInTx(
    tx: any,
    ctx: StockGlPostingContext,
    doc: {
      openingStockId: string;
      date: Date;
      description?: string | null;
      sourceNumber: string;
      sourceYearId: string;
      accountValues: Map<string, number>;
    }
  ) {
    const totalValue = roundTo4(
      [...doc.accountValues.values()].reduce((s, v) => s + v, 0)
    );
    if (totalValue <= 0) return null;

    // Don't let an unconfigured chart of accounts block the inventory
    // quantity/cost effect (which already applies unconditionally) — a
    // company that hasn't wired up its inventory GL accounts yet simply
    // gets no GL entry, same as before this fix, rather than a hard
    // failure on every opening-stock create.
    const accounts = await resolveStockGlAccounts(ctx.companyId).catch((err) => {
      logger.warn(
        { companyId: ctx.companyId, error: err instanceof Error ? err.message : err },
        'Opening balance GL posting skipped — inventory GL accounts not configured'
      );
      return null;
    });
    if (!accounts) return null;
    const lines: JournalEntryLineData[] = [];
    let lineOrder = 1;
    for (const [accountId, value] of doc.accountValues.entries()) {
      if (value === 0) continue;
      lines.push({
        accountId,
        debit: value,
        credit: 0,
        lineOrder: lineOrder++,
        description: 'Opening balance — inventory',
      });
    }
    lines.push({
      accountId: accounts.adjustmentAccountId,
      debit: 0,
      credit: totalValue,
      lineOrder: lineOrder++,
      description: 'Opening balance — offset (reclass to equity separately)',
    });

    const je = await journalPostingService.createAndPostInTx(tx, ctx, {
      date: doc.date,
      description: doc.description ?? `Opening stock ${doc.sourceNumber}`,
      currencyCode: 'EGP',
      fiscalYearId: ctx.fiscalYearId,
      sourceType: SOURCE_TYPE,
      sourceNumber: doc.sourceNumber,
      sourceYearId: doc.sourceYearId,
      entryType: 'OPENING_BALANCE',
      lines,
    });
    await tx.openingStock.update({
      where: { id: doc.openingStockId },
      data: {
        record: je.legacyGlNum ?? je.id,
        journalEntryId: je.id,
      },
    });
    return je;
  }

  /**
   * Create opening stock entry
   */
  async createOpeningStock(
    companyId: string,
    data: CreateOpeningStockData,
    glCtx?: StockGlPostingContext
  ) {
    try {
      // Validate all items and warehouses belong to company
      const itemIds = data.lines.map((line) => line.itemId);
      const warehouseIds = data.lines.map((line) => line.warehouseId).filter(Boolean);

      const items = await prisma.item.findMany({
        where: {
          id: { in: itemIds },
          companyId,
        },
      });

      if (items.length !== itemIds.length) {
        throw new Error('One or more items not found or do not belong to company');
      }

      if (warehouseIds.length > 0) {
        const warehouses = await prisma.warehouse.findMany({
          where: {
            id: { in: warehouseIds },
            companyId,
          },
        });

        if (warehouses.length !== warehouseIds.length) {
          throw new Error('One or more warehouses not found or do not belong to company');
        }
      }

      // Use transaction to ensure atomicity
      const openingStock = await prisma.$transaction(async (tx) => {
        // Create opening stock record
        const record = await tx.openingStock.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial: data.serial || null,
            date: new Date(data.date),
            isPosted: false,
            isApproved: false,
            isCancelled: false,
            totalAmount: data.lines.reduce((sum, line) => sum + line.total, 0),
          },
        });

        // H1 fix: route the quantity mutation through stockMovementService
        // (row lock + InventoryMovement audit row + negative-stock guard)
        // instead of an unlocked read-modify-write on item_quantities. Kept
        // at create time (not post time) to preserve this document's
        // existing behaviour of taking immediate effect.
        const sourceType = SOURCE_TYPE;
        const sourceNumber = data.serial ?? record.id.slice(0, 8);
        const sourceYearId = String(new Date(data.date).getFullYear());

        // Create opening stock lines and update item quantities
        const lines = [];
        const accountValues = new Map<string, number>();
        for (const lineData of data.lines) {
          // Create opening stock line
          const line = await tx.openingStockLine.create({
            data: {
              openingStockId: record.id,
              itemId: lineData.itemId,
              warehouseId: lineData.warehouseId,
              locationId: lineData.locationId || null,
              quantity: lineData.quantity,
              unitPrice: lineData.unitPrice,
              total: lineData.total,
            },
          });
          lines.push(line);

          await inventoryCostingService.applyInboundMovement(tx, {
            companyId,
            branchId: data.branchId ?? undefined,
            warehouseId: lineData.warehouseId,
            itemId: lineData.itemId,
            locationId: lineData.locationId ?? null,
            quantity: Number(lineData.quantity),
            unitCost: Number(lineData.unitPrice),
            movementType: COSTING_MOVEMENT.ADJUSTMENT_POSITIVE,
            sourceType,
            sourceNumber,
            sourceYearId,
            sourceDocumentId: record.id,
            transactionDate: new Date(data.date),
          });

          const item = await tx.item.findUnique({
            where: { id: lineData.itemId },
            select: { mainAccountId: true },
          });
          const value = roundTo4(Number(lineData.quantity) * Number(lineData.unitPrice));
          if (item?.mainAccountId && value !== 0) {
            accountValues.set(
              item.mainAccountId,
              roundTo4((accountValues.get(item.mainAccountId) ?? 0) + value)
            );
          }
        }

        if (glCtx) {
          await this.postOpeningBalanceGlInTx(tx, glCtx, {
            openingStockId: record.id,
            date: new Date(data.date),
            description: data.description,
            sourceNumber,
            sourceYearId,
            accountValues,
          });
        }

        return {
          ...record,
          lines,
        };
      });

      logger.info(
        { companyId, openingStockId: openingStock.id, linesCount: data.lines.length },
        'Opening stock created'
      );

      return openingStock;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating opening stock');
      throw error;
    }
  }

  /**
   * Get opening stock by ID
   */
  async getOpeningStockById(companyId: string, openingStockId: string) {
    try {
      const openingStock = await prisma.openingStock.findFirst({
        where: {
          id: openingStockId,
          companyId,
        },
        include: {
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
              warehouse: {
                select: {
                  id: true,
                  code: true,
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

      if (!openingStock) {
        throw new Error('Opening stock not found');
      }

      return openingStock;
    } catch (error) {
      logger.error({ error, companyId, openingStockId }, 'Error getting opening stock');
      throw error;
    }
  }

  /**
   * List opening stock entries
   */
  async listOpeningStock(
    companyId: string,
    options?: {
      branchId?: string;
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

      const [openingStock, total] = await Promise.all([
        prisma.openingStock.findMany({
          where,
          include: {
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
                warehouse: {
                  select: {
                    id: true,
                    code: true,
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
        prisma.openingStock.count({ where }),
      ]);

      return {
        data: openingStock,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing opening stock');
      throw error;
    }
  }

  /**
   * Post opening stock (make it final)
   */
  async postOpeningStock(
    companyId: string,
    openingStockId: string,
    glCtx?: StockGlPostingContext
  ) {
    await assertStoreDocumentRight(glCtx, 'openingStock', 'post');
    try {
      const openingStock = await prisma.openingStock.findFirst({
        where: {
          id: openingStockId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!openingStock) {
        throw new Error('Opening stock not found');
      }

      if (openingStock.isCancelled) {
        throw new Error('Cannot post cancelled opening stock');
      }

      if (openingStock.isPosted) {
        throw new Error('Opening stock is already posted');
      }

      await fiscalYearService.assertOpenForDate(companyId, openingStock.date);

      // Update to posted
      const updated = await prisma.openingStock.update({
        where: { id: openingStockId },
        data: {
          isPosted: true,
          postedAt: new Date(),
        },
      });

      logger.info({ companyId, openingStockId }, 'Opening stock posted');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, openingStockId }, 'Error posting opening stock');
      throw error;
    }
  }

  /**
   * Unpost opening stock
   */
  async unpostOpeningStock(
    companyId: string,
    openingStockId: string,
    glCtx?: StockGlPostingContext
  ) {
    await assertStoreDocumentRight(glCtx, 'openingStock', 'unpost');
    try {
      const openingStock = await prisma.openingStock.findFirst({
        where: {
          id: openingStockId,
          companyId,
        },
      });

      if (!openingStock) {
        throw new Error('Opening stock not found');
      }

      if (!openingStock.isPosted) {
        throw new Error('Opening stock is not posted');
      }

      await fiscalYearService.assertOpenForDate(companyId, openingStock.date);

      const sourceType = SOURCE_TYPE;
      const sourceNumber = openingStock.serial ?? openingStock.id.slice(0, 8);
      const sourceYearId = String(new Date(openingStock.date).getFullYear());

      // Reverse item quantities
      await prisma.$transaction(async (tx) => {
        const lines = await tx.openingStockLine.findMany({
          where: { openingStockId },
        });

        for (const line of lines) {
          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: openingStock.branchId ?? undefined,
            warehouseId: line.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            quantityDelta: -Number(line.quantity),
            movementType: `${sourceType}-UNPOST`,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            documentDate: openingStock.date,
          });

          // Mirror assembly/disassembly: the opening-balance cost entry is
          // removed outright rather than re-averaged out (safe because it
          // is keyed to this exact document, and re-averaging a removal
          // the way SALE_RETURN used to is exactly the bug Phase 2 fixed
          // elsewhere).
          await itemCostService.removeCostHistoryBySourceInTx(tx, {
            companyId,
            itemId: line.itemId,
            sourceType,
            sourceNumber,
            sourceYearId,
          });
        }

        if (glCtx) {
          await stockMovementGlService.reverseBySourceInTx(
            tx,
            glCtx,
            sourceType,
            sourceNumber,
            sourceYearId,
            'Opening stock unposted'
          );
        }

        // Update to unposted
        await tx.openingStock.update({
          where: { id: openingStockId },
          data: {
            isPosted: false,
            postedAt: null,
          },
        });
      });

      logger.info({ companyId, openingStockId }, 'Opening stock unposted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, openingStockId }, 'Error unposting opening stock');
      throw error;
    }
  }

  /**
   * Cancel opening stock
   */
  async cancelOpeningStock(
    companyId: string,
    openingStockId: string,
    glCtx?: StockGlPostingContext
  ) {
    try {
      const openingStock = await prisma.openingStock.findFirst({
        where: {
          id: openingStockId,
          companyId,
        },
        include: { lines: true },
      });

      if (!openingStock) {
        throw new Error('Opening stock not found');
      }

      if (openingStock.isCancelled) {
        throw new Error('Opening stock is already cancelled');
      }

      if (openingStock.isPosted) {
        throw new Error('Cannot cancel posted opening stock. Unpost it first.');
      }

      // The quantity/cost/GL effect is applied at create time (not post
      // time), so a still-draft (unposted) opening stock has already moved
      // stock. Reverse it all here — otherwise cancelling leaves a stray,
      // unaccounted-for quantity/cost/GL increment forever.
      const sourceType = SOURCE_TYPE;
      const sourceNumber = openingStock.serial ?? openingStock.id.slice(0, 8);
      const sourceYearId = String(new Date(openingStock.date).getFullYear());

      const updated = await prisma.$transaction(async (tx) => {
        for (const line of openingStock.lines) {
          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: openingStock.branchId ?? undefined,
            warehouseId: line.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            quantityDelta: -Number(line.quantity),
            movementType: `${sourceType}-CANCEL`,
            sourceType: `${sourceType}-CANCEL`,
            sourceNumber,
            sourceYearId,
            documentDate: openingStock.date,
          });

          await itemCostService.removeCostHistoryBySourceInTx(tx, {
            companyId,
            itemId: line.itemId,
            sourceType,
            sourceNumber,
            sourceYearId,
          });
        }

        if (glCtx) {
          await stockMovementGlService.reverseBySourceInTx(
            tx,
            glCtx,
            sourceType,
            sourceNumber,
            sourceYearId,
            'Opening stock cancelled'
          );
        }

        return tx.openingStock.update({
          where: { id: openingStockId },
          data: {
            isCancelled: true,
            cancelledAt: new Date(),
          },
        });
      });

      logger.info({ companyId, openingStockId }, 'Opening stock cancelled');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, openingStockId }, 'Error cancelling opening stock');
      throw error;
    }
  }

  /**
   * Restore cancelled opening stock
   */
  async restoreOpeningStock(
    companyId: string,
    openingStockId: string,
    glCtx?: StockGlPostingContext
  ) {
    try {
      const openingStock = await prisma.openingStock.findFirst({
        where: {
          id: openingStockId,
          companyId,
        },
        include: { lines: true },
      });

      if (!openingStock) {
        throw new Error('Opening stock not found');
      }

      if (!openingStock.isCancelled) {
        throw new Error('Opening stock is not cancelled');
      }

      // Symmetric with cancelOpeningStock: re-apply the quantity/cost/GL
      // effect that was reversed on cancel.
      const sourceType = SOURCE_TYPE;
      const sourceNumber = openingStock.serial ?? openingStock.id.slice(0, 8);
      const sourceYearId = String(new Date(openingStock.date).getFullYear());

      const updated = await prisma.$transaction(async (tx) => {
        const accountValues = new Map<string, number>();
        for (const line of openingStock.lines) {
          await inventoryCostingService.applyInboundMovement(tx, {
            companyId,
            branchId: openingStock.branchId ?? undefined,
            warehouseId: line.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            quantity: Number(line.quantity),
            unitCost: Number(line.unitPrice),
            movementType: COSTING_MOVEMENT.ADJUSTMENT_POSITIVE,
            sourceType,
            sourceNumber,
            sourceYearId,
            sourceDocumentId: openingStock.id,
            transactionDate: openingStock.date,
          });

          const item = await tx.item.findUnique({
            where: { id: line.itemId },
            select: { mainAccountId: true },
          });
          const value = roundTo4(Number(line.quantity) * Number(line.unitPrice));
          if (item?.mainAccountId && value !== 0) {
            accountValues.set(
              item.mainAccountId,
              roundTo4((accountValues.get(item.mainAccountId) ?? 0) + value)
            );
          }
        }

        if (glCtx) {
          await this.postOpeningBalanceGlInTx(tx, glCtx, {
            openingStockId: openingStock.id,
            date: openingStock.date,
            description: openingStock.description,
            sourceNumber,
            sourceYearId,
            accountValues,
          });
        }

        return tx.openingStock.update({
          where: { id: openingStockId },
          data: {
            isCancelled: false,
            cancelledAt: null,
          },
        });
      });

      logger.info({ companyId, openingStockId }, 'Opening stock restored');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, openingStockId }, 'Error restoring opening stock');
      throw error;
    }
  }

  /**
   * Sum of opening-stock line valuations for the company's active fiscal year:
   * Σ (quantity × unitPrice). Used by the opening-balance journal screen.
   */
  async getTotalValuation(companyId: string, fiscalYearId?: string) {
    let year = fiscalYearId
      ? await prisma.fiscalYear.findFirst({
          where: { id: fiscalYearId, companyId },
          select: { id: true, startDate: true, endDate: true },
        })
      : null;
    if (!year) {
      const resolvedId = await fiscalYearService.resolveDefaultFiscalYearId(companyId);
      year = resolvedId
        ? await prisma.fiscalYear.findFirst({
            where: { id: resolvedId, companyId },
            select: { id: true, startDate: true, endDate: true },
          })
        : null;
    }

    const dateFilter = year
      ? { gte: year.startDate, lte: year.endDate }
      : undefined;

    const lines = await prisma.openingStockLine.findMany({
      where: {
        openingStock: {
          companyId,
          isCancelled: false,
          ...(dateFilter ? { date: dateFilter } : {}),
        },
      },
      select: {
        quantity: true,
        unitPrice: true,
        itemId: true,
        warehouseId: true,
      },
    });

    let totalValuation = 0;
    const itemIds = new Set<string>();
    const warehouseIds = new Set<string>();
    for (const line of lines) {
      totalValuation += Number(line.quantity || 0) * Number(line.unitPrice || 0);
      if (line.itemId) itemIds.add(line.itemId);
      if (line.warehouseId) warehouseIds.add(line.warehouseId);
    }
    totalValuation = roundTo4(totalValuation);

    let defaultStockAccountId: string | null = null;
    try {
      const accounts = await resolveStockGlAccounts(companyId);
      defaultStockAccountId = accounts.inventoryAccountId ?? null;
    } catch {
      defaultStockAccountId = null;
    }

    if (!defaultStockAccountId) {
      const fallback = await prisma.account.findFirst({
        where: {
          companyId,
          isActive: true,
          deletedAt: null,
          OR: [
            { code: { startsWith: '123' } },
            { arabicName: { contains: 'بضاعة أول المدة' } },
            { arabicName: { contains: 'مخزون' } },
          ],
        },
        orderBy: { code: 'asc' },
        select: { id: true },
      });
      defaultStockAccountId = fallback?.id ?? null;
    }

    return {
      totalValuation,
      currency: 'EGP',
      itemsCount: itemIds.size,
      warehousesCount: warehouseIds.size,
      defaultStockAccountId,
    };
  }
}

export const openingStockService = new OpeningStockService();

