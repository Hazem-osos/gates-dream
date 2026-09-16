import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';
import { resolveInvoiceLineWarehouseId } from '../../invoices/services/invoice-m5-integrity.service';
import { itemCostService } from './item-cost.service';
import { splitLandedCostCapitalization } from './landed-cost-math';
import { resolveStockGlAccounts } from './stock-movement-gl.service';
import { loadWarehouseGlMap, pickInventoryAccount } from '../utils/inventory-system';

export interface StockGlPostingContext extends JournalPostingContext {
  fiscalYearId: string;
}

export interface CreateLandedCostAllocationData {
  companyId: string;
  branchId?: string | null;
  invoiceId: string;
  description?: string;
  serial?: string;
  date: string;
  totalAmount: number;
  expenseAccountId: string;
}

const SOURCE_TYPE = 'LCA';

/**
 * H9 fix — landed-cost capitalization.
 *
 * Freight/customs/insurance/handling incurred to bring a PURCHASE invoice's
 * goods into the warehouse are usually recorded first against an expense
 * (or clearing) account — e.g. a broker's invoice posted normally through
 * treasury/AP. This service reallocates that already-recorded amount out
 * of the expense account and into the received items' inventory value,
 * split across the invoice's lines by their merchandise-value share, then
 * tops up each item's moving-average cost accordingly. The original
 * PURCHASE invoice, its lines and its own journal entry are never mutated.
 */
export class LandedCostService {
  async createAllocation(companyId: string, data: CreateLandedCostAllocationData) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, companyId },
      include: { lines: true },
    });
    if (!invoice) {
      throw new AppError(404, 'Invoice not found or does not belong to company');
    }
    if (invoice.invoiceKind !== 'PURCHASE') {
      throw new AppError(422, 'Landed costs can only be allocated to a PURCHASE invoice');
    }
    if (!invoice.isPosted) {
      throw new AppError(422, 'Invoice must be posted before landed costs can be allocated to it');
    }
    if (invoice.lines.length === 0) {
      throw new AppError(422, 'Invoice has no lines to allocate landed cost against');
    }

    const expenseAccount = await prisma.account.findFirst({
      where: { id: data.expenseAccountId, companyId },
    });
    if (!expenseAccount) {
      throw new AppError(404, 'Expense account not found or does not belong to company');
    }

    // Allocate proportional to each line's gross merchandise value
    // (quantity × price, before discount/tax) — the natural cost-driver
    // basis for freight/customs/etc.
    const totalMerchandiseValue = invoice.lines.reduce((s, l) => s + Number(l.total), 0);
    if (totalMerchandiseValue <= 0) {
      throw new AppError(422, 'Invoice has no merchandise value to allocate landed cost against');
    }

    const totalAmount = roundTo4(data.totalAmount);
    const linesData = invoice.lines.map((line, idx) => {
      const merchandiseValue = roundTo4(Number(line.total));
      const isLast = idx === invoice.lines.length - 1;
      return { line, merchandiseValue, isLast };
    });

    let allocated = 0;
    const allocation = await prisma.$transaction(async (tx) => {
      const created = await tx.landedCostAllocation.create({
        data: {
          companyId,
          branchId: data.branchId || null,
          invoiceId: invoice.id,
          description: data.description || null,
          serial: data.serial || null,
          date: new Date(data.date),
          totalAmount,
          expenseAccountId: expenseAccount.id,
          isPosted: false,
          isCancelled: false,
        },
      });

      for (const { line, merchandiseValue, isLast } of linesData) {
        const share = isLast
          ? roundTo4(totalAmount - allocated)
          : roundTo4((totalAmount * merchandiseValue) / totalMerchandiseValue);
        allocated = roundTo4(allocated + share);
        const quantity = Number(line.baseQuantity);
        const unitCostAdded = quantity > 0 ? roundTo4(share / quantity) : 0;

        await tx.landedCostAllocationLine.create({
          data: {
            allocationId: created.id,
            invoiceLineId: line.id,
            itemId: line.itemId,
            merchandiseValue,
            allocatedAmount: share,
            quantity,
            unitCostAdded,
          },
        });
      }

      return created;
    });

    logger.info(
      { companyId, allocationId: allocation.id, invoiceId: invoice.id },
      'Landed cost allocation created'
    );

    return this.getAllocationById(companyId, allocation.id);
  }

  async getAllocationById(companyId: string, allocationId: string) {
    const allocation = await prisma.landedCostAllocation.findFirst({
      where: { id: allocationId, companyId },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, date: true, supplierId: true } },
        expenseAccount: { select: { id: true, code: true, arabicName: true } },
        lines: {
          include: {
            item: { select: { id: true, serial: true, arabicName: true } },
            invoiceLine: { select: { id: true, price: true, quantity: true } },
          },
        },
      },
    });
    if (!allocation) {
      throw new AppError(404, 'Landed cost allocation not found');
    }
    return allocation;
  }

  async listAllocations(
    companyId: string,
    options?: {
      branchId?: string;
      invoiceId?: string;
      isPosted?: boolean;
      isCancelled?: boolean;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Record<string, unknown> = { companyId };
    if (options?.branchId) where.branchId = options.branchId;
    if (options?.invoiceId) where.invoiceId = options.invoiceId;
    if (options?.isPosted !== undefined) where.isPosted = options.isPosted;
    if (options?.isCancelled !== undefined) where.isCancelled = options.isCancelled;

    const [data, total] = await Promise.all([
      prisma.landedCostAllocation.findMany({
        where,
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
          lines: { select: { id: true, itemId: true, allocatedAmount: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      prisma.landedCostAllocation.count({ where }),
    ]);

    return { data, total, skip: options?.skip || 0, take: options?.take || 50 };
  }

  /**
   * Post the allocation: capitalizes the still-on-hand share into warehouse
   * MAC and posts a reclass journal. Already-sold quantity is true'd up to
   * COGS (Dr COGS / Cr landed-cost clearing) instead of being dropped.
   */
  async postAllocation(companyId: string, allocationId: string, glCtx: StockGlPostingContext) {
    const allocation = await prisma.landedCostAllocation.findFirst({
      where: { id: allocationId, companyId },
      include: {
        lines: {
          include: {
            item: { select: { id: true, mainAccountId: true, cogsAccountId: true } },
            invoiceLine: { select: { id: true, warehouseId: true } },
          },
        },
        invoice: { select: { id: true, date: true, invoiceNumber: true, warehouseId: true } },
      },
    });
    if (!allocation) {
      throw new AppError(404, 'Landed cost allocation not found');
    }
    if (allocation.isCancelled) {
      throw new AppError(422, 'Cannot post a cancelled landed cost allocation');
    }
    if (allocation.isPosted) {
      throw new AppError(422, 'Landed cost allocation is already posted');
    }

    const serial = allocation.serial ?? allocation.id.slice(0, 8);
    const sourceYearId = String(new Date(allocation.date).getFullYear());
    const invoiceNumber = allocation.invoice.invoiceNumber ?? serial;
    const stockAccounts = await resolveStockGlAccounts(companyId);
    const warehouseMap = await loadWarehouseGlMap(
      companyId,
      allocation.lines.map((line) =>
        resolveInvoiceLineWarehouseId(line.invoiceLine.warehouseId, allocation.invoice.warehouseId)
      )
    );
    const skippedItems: string[] = [];

    const je = await prisma.$transaction(async (tx) => {
      const inventoryByAccount = new Map<string, number>();
      const cogsByAccount = new Map<string, number>();

      for (const line of allocation.lines) {
        const warehouseId = resolveInvoiceLineWarehouseId(
          line.invoiceLine.warehouseId,
          allocation.invoice.warehouseId
        );
        let currentOnHand = 0;
        if (warehouseId) {
          const warehouseBalance = await tx.itemWarehouseBalance.findUnique({
            where: {
              companyId_itemId_warehouseId: {
                companyId,
                itemId: line.itemId,
                warehouseId,
              },
            },
            select: { quantityOnHand: true },
          });
          currentOnHand = Number(warehouseBalance?.quantityOnHand || 0);
        } else {
          currentOnHand = await itemCostService.getCompanyItemQuantityAsOfInTx(
            tx,
            companyId,
            line.itemId,
            allocation.date
          );
        }

        const split = splitLandedCostCapitalization({
          allocatedCost: Number(line.allocatedAmount),
          receivedQty: Number(line.quantity),
          onHandQty: currentOnHand,
        });

        if (split.capitalizeAmount > 0) {
          const result = await itemCostService.capitalizeAdditionalCostInTx(tx, {
            companyId,
            branchId: allocation.branchId ?? undefined,
            itemId: line.itemId,
            warehouseId,
            asOfDate: allocation.date,
            additionalCost: split.capitalizeAmount,
            sourceNum: serial,
            sourceYearId,
            sourceType: SOURCE_TYPE,
          });
          if (!result) {
            split.cogsTrueUpAmount = roundTo4(split.cogsTrueUpAmount + split.capitalizeAmount);
            split.capitalizeAmount = 0;
            skippedItems.push(line.itemId);
          } else {
            const inventoryAccountId =
              pickInventoryAccount(
                stockAccounts.system,
                stockAccounts.companyInventoryAccountId,
                warehouseMap.get(warehouseId ?? '')?.inventoryAccountId,
                line.item.mainAccountId
              ) || stockAccounts.inventoryAccountId;
            inventoryByAccount.set(
              inventoryAccountId,
              roundTo4((inventoryByAccount.get(inventoryAccountId) ?? 0) + split.capitalizeAmount)
            );
          }
        }

        if (split.cogsTrueUpAmount > 0) {
          const cogsAccountId =
            pickInventoryAccount(
              stockAccounts.system,
              stockAccounts.companyExpenseAccountId,
              warehouseMap.get(warehouseId ?? '')?.costAccountId,
              line.item.cogsAccountId
            ) || stockAccounts.expenseAccountId;
          cogsByAccount.set(
            cogsAccountId,
            roundTo4((cogsByAccount.get(cogsAccountId) ?? 0) + split.cogsTrueUpAmount)
          );
        }
      }

      const lines: JournalEntryLineData[] = [];
      let lineOrder = 1;
      let totalDebit = 0;
      for (const [accountId, amount] of inventoryByAccount.entries()) {
        if (amount === 0) continue;
        totalDebit = roundTo4(totalDebit + amount);
        lines.push({
          accountId,
          debit: amount,
          credit: 0,
          lineOrder: lineOrder++,
          description: `Landed cost capitalized — allocation ${serial}`,
        });
      }
      for (const [accountId, amount] of cogsByAccount.entries()) {
        if (amount === 0) continue;
        totalDebit = roundTo4(totalDebit + amount);
        lines.push({
          accountId,
          debit: amount,
          credit: 0,
          lineOrder: lineOrder++,
          description: `تسوية تكلفة شحن بضاعة مباعة مسبقاً - فاتورة ${invoiceNumber}`,
        });
      }
      if (totalDebit > 0) {
        lines.push({
          accountId: allocation.expenseAccountId,
          debit: 0,
          credit: totalDebit,
          lineOrder: lineOrder++,
          description: `Landed cost reclassified from expense — allocation ${serial}`,
        });
      }

      if (lines.length === 0) {
        throw new AppError(
          422,
          'Landed cost allocation cannot be posted: allocated amount is zero.'
        );
      }

      const createdJe = await journalPostingService.createAndPostInTx(tx, glCtx, {
        date: allocation.date,
        description: allocation.description ?? `Landed cost allocation ${serial}`,
        currencyCode: 'EGP',
        fiscalYearId: glCtx.fiscalYearId,
        sourceType: SOURCE_TYPE,
        sourceNumber: serial,
        sourceYearId,
        entryType: 'LANDED_COST',
        lines,
      });

      await tx.landedCostAllocation.update({
        where: { id: allocation.id },
        data: { record: createdJe.legacyGlNum ?? createdJe.id },
      });

      await tx.landedCostAllocation.update({
        where: { id: allocation.id },
        data: { isPosted: true, postedAt: new Date() },
      });

      return createdJe;
    });

    if (skippedItems.length > 0) {
      logger.warn(
        { companyId, allocationId, skippedItems },
        'Landed cost allocation posted, but some items had zero on-hand quantity — cost could not be capitalized for them'
      );
    }

    logger.info({ companyId, allocationId, journalEntryId: je?.id }, 'Landed cost allocation posted');
    return { success: true, journalEntryId: je?.id ?? null, skippedItems };
  }

  /** Reverse the moving-average top-up and the GL entry via a dated contra reversal. */
  async unpostAllocation(companyId: string, allocationId: string, glCtx: StockGlPostingContext) {
    const allocation = await prisma.landedCostAllocation.findFirst({
      where: { id: allocationId, companyId },
      include: { lines: true },
    });
    if (!allocation) {
      throw new AppError(404, 'Landed cost allocation not found');
    }
    if (!allocation.isPosted) {
      throw new AppError(422, 'Landed cost allocation is not posted');
    }

    const serial = allocation.serial ?? allocation.id.slice(0, 8);
    const sourceYearId = String(new Date(allocation.date).getFullYear());

    await prisma.$transaction(async (tx) => {
      for (const line of allocation.lines) {
        await itemCostService.removeCostHistoryBySourceInTx(tx, {
          companyId,
          itemId: line.itemId,
          sourceType: SOURCE_TYPE,
          sourceNumber: serial,
          sourceYearId,
        });
      }

      const key = journalPostingService.buildActiveSourceKey(
        companyId,
        SOURCE_TYPE,
        serial,
        sourceYearId
      );
      const je = key ? await tx.journalEntry.findUnique({ where: { activeSourceKey: key } }) : null;
      if (je) {
        await journalPostingService.reverseJournalEntryInTx(tx, glCtx, je.id, {
          reason: `Landed cost allocation ${serial} unposted`,
        });
      }

      await tx.landedCostAllocation.update({
        where: { id: allocation.id },
        data: { isPosted: false, postedAt: null },
      });
    });

    logger.info({ companyId, allocationId }, 'Landed cost allocation unposted');
    return { success: true };
  }

  async cancelAllocation(companyId: string, allocationId: string) {
    const allocation = await prisma.landedCostAllocation.findFirst({
      where: { id: allocationId, companyId },
    });
    if (!allocation) {
      throw new AppError(404, 'Landed cost allocation not found');
    }
    if (allocation.isPosted) {
      throw new AppError(422, 'Cannot cancel a posted landed cost allocation. Unpost it first.');
    }
    if (allocation.isCancelled) {
      throw new AppError(422, 'Landed cost allocation is already cancelled');
    }

    return prisma.landedCostAllocation.update({
      where: { id: allocationId },
      data: { isCancelled: true, cancelledAt: new Date() },
    });
  }
}

export const landedCostService = new LandedCostService();
