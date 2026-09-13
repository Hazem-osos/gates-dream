import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import type { JournalPostingContext } from '../../accounting/services/journal-posting.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { invoicePostingOrchestrator } from '../../invoices/services/invoice-posting-orchestrator';
import type { InvoicePostingContext } from '../../invoices/types/invoice-posting.types';
import { treasuryPostingService } from '../../treasury/services/treasury-posting.service';
import type { TreasuryPostingContext } from '../../treasury/types/treasury.types';
import { posShiftService } from '../../pos/services/pos-shift.service';
import type { PosPostingContext } from '../../pos/types/pos.types';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';

const CHUNK_SIZE = 25;

export type BatchDocumentType =
  | 'JOURNAL_ENTRY'
  | 'INVOICE'
  | 'TREASURY'
  | 'POS_SHIFT';

export interface BatchOperationInput {
  companyId: string;
  branchId?: string;
  fiscalYearId?: string;
  documentType: BatchDocumentType;
  fromDate: Date;
  toDate: Date;
  sourceFrom?: string;
  sourceTo?: string;
}

export interface BatchOperationResult {
  totalEligible: number;
  succeeded: number;
  failed: number;
  errorDetails: Array<{ id: string; message: string }>;
}

export class BatchOperationsService {
  /** Invoice posting always needs a resolved fiscal year (stock + GL + party in one txn). */
  private invoiceCtx(
    ctx: JournalPostingContext,
    input: BatchOperationInput
  ): InvoicePostingContext {
    const fiscalYearId = input.fiscalYearId ?? ctx.fiscalYearId;
    if (!fiscalYearId) {
      throw new AppError(422, 'Fiscal year is required for batch invoice posting');
    }
    return { ...ctx, fiscalYearId };
  }

  private async eligibleJournalIds(input: BatchOperationInput, forUnpost: boolean) {
    return prisma.journalEntry.findMany({
      where: {
        companyId: input.companyId,
        isCancelled: false,
        deletedAt: null,
        isPosted: forUnpost,
        postingStatus: forUnpost ? 'Post' : 'UnPost',
        date: { gte: input.fromDate, lte: input.toDate },
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.fiscalYearId ? { fiscalYearId: input.fiscalYearId } : {}),
      },
      select: { id: true },
      orderBy: { date: 'asc' },
    });
  }

  private async eligibleInvoiceIds(input: BatchOperationInput, forUnpost: boolean) {
    return prisma.invoice.findMany({
      where: {
        companyId: input.companyId,
        isCancelled: false,
        isPosted: forUnpost,
        date: { gte: input.fromDate, lte: input.toDate },
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.fiscalYearId ? { fiscalYearId: input.fiscalYearId } : {}),
      },
      select: { id: true },
      orderBy: { date: 'asc' },
    });
  }

  private async eligibleTreasuryIds(input: BatchOperationInput, forUnpost: boolean) {
    return prisma.cashTransaction.findMany({
      where: {
        companyId: input.companyId,
        isCancelled: false,
        isPosted: forUnpost,
        date: { gte: input.fromDate, lte: input.toDate },
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.fiscalYearId ? { fiscalYearId: input.fiscalYearId } : {}),
      },
      select: { id: true },
      orderBy: { date: 'asc' },
    });
  }

  private async eligiblePosShiftIds(input: BatchOperationInput, forUnpost: boolean) {
    return prisma.posShift.findMany({
      where: {
        companyId: input.companyId,
        openedAt: { gte: input.fromDate, lte: input.toDate },
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.fiscalYearId ? { fiscalYearId: input.fiscalYearId } : {}),
        endOfDayJournalEntryId: forUnpost ? { not: null } : null,
      },
      select: { id: true },
      orderBy: { openedAt: 'asc' },
    });
  }

  async batchPost(
    ctx: JournalPostingContext,
    treasuryCtx: TreasuryPostingContext,
    input: BatchOperationInput
  ): Promise<BatchOperationResult> {
    if (input.fiscalYearId) {
      await fiscalYearService.assertOpenById(input.companyId, input.fiscalYearId);
    }

    const ids = await this.resolveIds(input, false);
    return this.processBatch(ids, async (id) => {
      switch (input.documentType) {
        case 'JOURNAL_ENTRY':
          await journalPostingService.postJournalEntry(ctx, id);
          break;
        case 'INVOICE':
          await invoicePostingOrchestrator.post(this.invoiceCtx(ctx, input), id);
          break;
        case 'TREASURY':
          await treasuryPostingService.postCashTransaction(treasuryCtx, id);
          break;
        case 'POS_SHIFT': {
          const shift = await posShiftService.getShift(ctx.companyId, id);
          if (shift.endOfDayJournalEntryId) {
            throw new AppError(400, 'POS shift already has an end-of-day journal entry');
          }
          if (shift.status !== 'OPEN') {
            throw new AppError(400, 'Only open POS shifts can be batch-closed');
          }
          const cashNet = Number(shift.totalCashSales);
          const closingCashSystem = Number(shift.openingCash) + cashNet;
          const posCtx: PosPostingContext = {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            fiscalYearId: ctx.fiscalYearId!,
            userId: ctx.userId,
          };
          await posShiftService.closeShift(posCtx, id, closingCashSystem);
          break;
        }
        default:
          throw new AppError(422, 'Unsupported document type');
      }
    });
  }

  async batchUnpost(
    ctx: JournalPostingContext,
    treasuryCtx: TreasuryPostingContext,
    input: BatchOperationInput
  ): Promise<BatchOperationResult> {
    if (input.fiscalYearId) {
      await fiscalYearService.assertOpenById(input.companyId, input.fiscalYearId);
    }

    const ids = await this.resolveIds(input, true);
    return this.processBatch(ids, async (id) => {
      switch (input.documentType) {
        case 'JOURNAL_ENTRY':
          await journalPostingService.unpostJournalEntry(ctx, id);
          break;
        case 'INVOICE':
          await invoicePostingOrchestrator.unpost(this.invoiceCtx(ctx, input), id);
          break;
        case 'TREASURY':
          await treasuryPostingService.unpostCashTransaction(treasuryCtx, id);
          break;
        case 'POS_SHIFT':
          throw new AppError(
            501,
            'POS shift batch unpost is not supported; reverse the end-of-day journal entry manually'
          );
        default:
          throw new AppError(422, 'Unsupported document type');
      }
    });
  }

  private async resolveIds(input: BatchOperationInput, forUnpost: boolean): Promise<string[]> {
    switch (input.documentType) {
      case 'JOURNAL_ENTRY':
        return (await this.eligibleJournalIds(input, forUnpost)).map((r) => r.id);
      case 'INVOICE':
        return (await this.eligibleInvoiceIds(input, forUnpost)).map((r) => r.id);
      case 'TREASURY':
        return (await this.eligibleTreasuryIds(input, forUnpost)).map((r) => r.id);
      case 'POS_SHIFT':
        return (await this.eligiblePosShiftIds(input, forUnpost)).map((r) => r.id);
      default:
        return [];
    }
  }

  private async processBatch(
    ids: string[],
    handler: (id: string) => Promise<void>
  ): Promise<BatchOperationResult> {
    const result: BatchOperationResult = {
      totalEligible: ids.length,
      succeeded: 0,
      failed: 0,
      errorDetails: [],
    };

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      for (const id of chunk) {
        try {
          await handler(id);
          result.succeeded += 1;
        } catch (e) {
          result.failed += 1;
          result.errorDetails.push({
            id,
            message: e instanceof Error ? e.message : 'Batch item failed',
          });
        }
      }
    }

    return result;
  }
}

export const batchOperationsService = new BatchOperationsService();
