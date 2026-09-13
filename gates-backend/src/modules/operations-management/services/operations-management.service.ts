import { logger } from '../../../shared/logger';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { inventoryCostingService } from '../../inventory/services/inventory-costing.service';

export interface DeleteCancelledOperationsOptions {
  operationTypes?: Array<'journal-entry' | 'invoice' | 'treasury-receipt' | 'treasury-payment' | 'all'>;
  fromDate?: Date;
  toDate?: Date;
  companyId: string;
}

export interface FixAverageCostOptions {
  itemIds?: string[];
  warehouseIds?: string[];
  recalculateFromDate?: Date;
  companyId: string;
}

export interface PostAllOperationsOptions {
  operationTypes?: Array<'journal-entry' | 'invoice' | 'treasury-receipt' | 'treasury-payment' | 'all'>;
  fromDate?: Date;
  toDate?: Date;
  companyId: string;
}

export class OperationsManagementService {
  /**
   * SECURITY/CORRECTNESS: this used to hard-`deleteMany` cancelled journal entries,
   * invoices, treasury receipts and payments straight out of the database. A "cancelled"
   * document can still carry posted journal lines and GL history; hard-deleting it removes
   * that trail permanently with no reversal, audit record, or balance check. Removed rather
   * than fixed — a safe equivalent (archive, or reverse-and-soft-delete) is out of scope for
   * a quick containment fix and needs its own design.
   */
  async deleteCancelledOperations(options: DeleteCancelledOperationsOptions): Promise<{ deleted: number }> {
    logger.warn({ options }, 'Blocked attempt to use disabled deleteCancelledOperations (hard-delete of financial documents)');
    throw new AppError(
      403,
      'Deleting cancelled operations is disabled: it permanently removed posted journal entries and financial documents with no audit trail or reversal. Cancel documents individually instead.'
    );
  }

  /**
   * frmRepairCost (إصلاح متوسط التكلفة): replay stock movements and restated
   * warehouse / item moving-average cost. Posted journals are never rewritten.
   */
  async fixAverageCost(options: FixAverageCostOptions): Promise<{ fixed: number }> {
    if (options.itemIds?.length) {
      let fixed = 0;
      for (const itemId of options.itemIds) {
        const result = await inventoryCostingService.recalculateItemCostHistory({
          companyId: options.companyId,
          itemId,
          startDate: options.recalculateFromDate,
          warehouseIds: options.warehouseIds,
        });
        fixed += result.items;
      }
      return { fixed };
    }

    const result = await inventoryCostingService.recalculateItemCostHistory({
      companyId: options.companyId,
      startDate: options.recalculateFromDate,
      warehouseIds: options.warehouseIds,
    });
    return { fixed: result.items };
  }

  /**
   * LEDGER INTEGRITY: this used to flip `isPosted: true` on every approved-but-unposted
   * journal entry/invoice with a bare `updateMany` — no journal lines, no debit/credit
   * balance check, no fiscal-period lock check, and no stock or party-balance effect. It
   * let documents become "posted" without ever going through the real posting service.
   * Removed rather than fixed: a correct bulk-post has to loop each document through its
   * real posting service (with its GL lines, locks and side effects), which is a redesign,
   * not a quick containment fix. Post documents individually through their own module.
   */
  async postAllOperations(options: PostAllOperationsOptions): Promise<{ posted: number; failed: number }> {
    logger.warn({ options }, 'Blocked attempt to use disabled postAllOperations (status-only bulk post, bypassed GL)');
    throw new AppError(
      403,
      'Posting all operations in bulk is disabled: it marked documents as posted without creating journal entries, balance checks, or fiscal-period locks. Post documents individually through their own module.'
    );
  }

  /**
   * Get statistics for post all operations
   */
  async getPostAllStatistics(companyId: string, fromDate?: Date, toDate?: Date) {
    try {
      const where: any = {
        companyId,
        isPosted: false,
        isCancelled: false,
        isApproved: true,
      };

      if (fromDate) {
        where.date = { gte: fromDate };
      }
      if (toDate) {
        where.date = { ...where.date, lte: toDate };
      }

      const [journalEntries, invoices, treasuryReceipts, treasuryPayments] = await Promise.all([
        prisma.journalEntry.count({ where }),
        prisma.invoice.count({ where }),
        prisma.treasuryReceipt.count({ where }),
        prisma.treasuryPayment.count({ where }),
      ]);

      return {
        journalEntries,
        invoices,
        treasuryReceipts,
        treasuryPayments,
        total: journalEntries + invoices + treasuryReceipts + treasuryPayments,
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error getting post all statistics');
      throw error;
    }
  }
}

export const operationsManagementService = new OperationsManagementService();

