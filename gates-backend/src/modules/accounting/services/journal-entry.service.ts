import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  CreateJournalEntryData,
  UpdateJournalEntryData,
} from '../types/journal-entry.types';
import {
  journalPostingService,
  JournalPostingContext,
} from './journal-posting.service';
import { openingBalanceService } from './opening-balance.service';
import { branchScopeFilter } from '../../../shared/auth/branch-scope';
import {
  clampKeysetLimit,
  isKeysetListRequest,
  paginateWithKeyset,
  type CursorDirection,
} from '../../../utils/pagination/keysetPagination';

export type {
  CreateJournalEntryData,
  JournalEntryLineData,
  UpdateJournalEntryData,
} from '../types/journal-entry.types';

export class JournalEntryService {
  buildPostingContext(
    companyId: string,
    branchId: string | undefined,
    userId: string,
    fiscalYearId?: string,
    isAdmin?: boolean
  ): JournalPostingContext {
    if (!branchId) {
      throw new AppError(400, 'يجب اختيار الفرع قبل الترحيل');
    }
    return { companyId, branchId, userId, fiscalYearId, isAdmin };
  }

  /**
   * Create a new journal entry with lines
   */
  async createJournalEntry(
    companyId: string,
    userId: string,
    data: CreateJournalEntryData,
    context?: { branchId?: string; fiscalYearId?: string; isAdmin?: boolean }
  ) {
    try {
      const ctx = this.buildPostingContext(
        companyId,
        context?.branchId,
        userId,
        context?.fiscalYearId,
        context?.isAdmin
      );
      const locked = await openingBalanceService.applyLockedDate(companyId, data);
      return await journalPostingService.createJournalEntry(ctx, locked);
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error({ error, companyId, data }, 'Error creating journal entry');
      }
      throw error;
    }
  }

  /**
   * Get journal entry by ID
   */
  async getJournalEntryById(companyId: string, journalEntryId: string) {
    const id = String(journalEntryId ?? '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new AppError(404, 'القيد غير موجود');
    }
    try {
      const journalEntry = await prisma.journalEntry.findFirst({
        where: {
          id,
          companyId,
          deletedAt: null,
        },
        include: {
          lines: {
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
              costCenter: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
            },
            orderBy: { lineOrder: 'asc' },
          },
        },
      });

      if (!journalEntry) {
        throw new AppError(404, 'القيد غير موجود');
      }

      return journalEntry;
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error({ error, companyId, journalEntryId: id }, 'Error getting journal entry');
      }
      throw error;
    }
  }

  /**
   * List journal entries with pagination and filters
   */
  async listJournalEntries(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      cursor?: string;
      direction?: CursorDirection;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      isPosted?: boolean;
      isApproved?: boolean;
      isCancelled?: boolean;
      includeLines?: boolean;
      entryType?: string;
      sortBy?: 'voucherNumber' | 'date' | 'createdAt';
      sortDir?: 'asc' | 'desc';
      branchId?: string;
      /**
       * Legacy `UserBranchesCond`: the branches this user may read, or `null`
       * for unrestricted. Without it a restricted user's unfiltered listing
       * still returned every branch's vouchers.
       */
      permittedBranchIds?: string[] | null;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,
        ...branchScopeFilter(options.permittedBranchIds ?? null, options.branchId),
      };

      if (options.search) {
        where.OR = [
          { voucherNumber: { contains: options.search } },
          { description: { contains: options.search } },
        ];
      }

      if (options.startDate || options.endDate) {
        where.date = {};
        if (options.startDate) where.date.gte = options.startDate;
        if (options.endDate) where.date.lte = options.endDate;
      }

      if (options.isPosted !== undefined) {
        where.isPosted = options.isPosted;
      }

      if (options.isApproved !== undefined) {
        where.isApproved = options.isApproved;
      }

      if (options.isCancelled !== undefined) {
        where.isCancelled = options.isCancelled;
      }

      if (options.entryType) {
        where.entryType = options.entryType;
      } else {
        where.NOT = { entryType: { in: ['OPENING_BALANCE', 'REVERSAL'] } };
      }

      const includeLines = options.includeLines === true;
      const sortDir = options.sortDir === 'desc' ? ('desc' as const) : ('asc' as const);
      const sortField = options.sortBy === 'date' || options.sortBy === 'createdAt' ? options.sortBy : 'voucherNumber';
      const orderBy = [{ [sortField]: sortDir }, { id: sortDir }];
      const lineInclude = {
        lines: {
          include: {
            account: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
          orderBy: { lineOrder: 'asc' as const },
        },
      };
      const listSelect = {
        id: true,
        companyId: true,
        branchId: true,
        fiscalYearId: true,
        voucherNumber: true,
        legacyGlNum: true,
        date: true,
        hijriDate: true,
        description: true,
        descriptionAr: true,
        currencyCode: true,
        postingStatus: true,
        isPosted: true,
        isApproved: true,
        isCancelled: true,
        sourceType: true,
        sourceKind: true,
        sourceId: true,
        sourceNumber: true,
        isRecurring: true,
        createdAt: true,
        updatedAt: true,
      };

      if (isKeysetListRequest(options)) {
        const keyed = includeLines
          ? await paginateWithKeyset(prisma.journalEntry, {
              cursor: options.cursor,
              limit: options.limit,
              direction: options.direction,
              where,
              orderBy,
              include: lineInclude,
            })
          : await paginateWithKeyset(prisma.journalEntry, {
              cursor: options.cursor,
              limit: options.limit,
              direction: options.direction,
              where,
              orderBy,
              select: listSelect,
            });
        const keysetLimit = clampKeysetLimit(options.limit);
        return {
          journalEntries: keyed.items,
          items: keyed.items,
          nextCursor: keyed.nextCursor,
          prevCursor: keyed.prevCursor,
          hasMore: keyed.hasMore,
          pagination: {
            limit: keysetLimit,
            nextCursor: keyed.nextCursor,
            prevCursor: keyed.prevCursor,
            hasMore: keyed.hasMore,
          },
        };
      }

      const listQuery = {
        where,
        skip,
        take: limit,
        orderBy,
      };

      const [journalEntries, total] = await Promise.all([
        includeLines
          ? prisma.journalEntry.findMany({
              ...listQuery,
              include: lineInclude,
            })
          : prisma.journalEntry.findMany({
              ...listQuery,
              select: listSelect,
            }),
        prisma.journalEntry.count({ where }),
      ]);

      return {
        journalEntries,
        items: journalEntries,
        nextCursor: null,
        prevCursor: null,
        hasMore: page * limit < total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing journal entries');
      throw error;
    }
  }

  /**
   * Update journal entry
   */
  async updateJournalEntry(
    companyId: string,
    journalEntryId: string,
    data: UpdateJournalEntryData,
    context?: { branchId?: string; fiscalYearId?: string; userId?: string; isAdmin?: boolean }
  ) {
    try {
      const ctx = this.buildPostingContext(
        companyId,
        context?.branchId,
        context?.userId ?? 'system',
        context?.fiscalYearId,
        context?.isAdmin
      );
      const existing = await prisma.journalEntry.findFirst({
        where: { id: journalEntryId, companyId },
        select: { entryType: true },
      });
      const locked = await openingBalanceService.applyLockedDate(
        companyId,
        data,
        existing?.entryType
      );
      return await journalPostingService.updateJournalEntry(
        ctx,
        journalEntryId,
        locked
      );
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error(
          { error, companyId, journalEntryId, data },
          'Error updating journal entry'
        );
      }
      throw error;
    }
  }

  /**
   * Post journal entry
   */
  async postJournalEntry(
    companyId: string,
    journalEntryId: string,
    context?: { branchId?: string; fiscalYearId?: string; userId?: string; isAdmin?: boolean }
  ) {
    try {
      const ctx = this.buildPostingContext(
        companyId,
        context?.branchId,
        context?.userId ?? 'system',
        context?.fiscalYearId,
        context?.isAdmin
      );
      return await journalPostingService.postJournalEntry(ctx, journalEntryId);
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error({ error, companyId, journalEntryId }, 'Error posting journal entry');
      }
      throw error;
    }
  }

  /**
   * Unpost journal entry
   */
  async unpostJournalEntry(
    companyId: string,
    journalEntryId: string,
    context?: { branchId?: string; fiscalYearId?: string; userId?: string; isAdmin?: boolean }
  ) {
    try {
      const ctx = this.buildPostingContext(
        companyId,
        context?.branchId,
        context?.userId ?? 'system',
        context?.fiscalYearId,
        context?.isAdmin
      );
      return await journalPostingService.unpostJournalEntry(ctx, journalEntryId);
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error(
          { error, companyId, journalEntryId },
          'Error unposting journal entry'
        );
      }
      throw error;
    }
  }

  /**
   * Approve journal entry
   */
  async approveJournalEntry(companyId: string, journalEntryId: string) {
    try {
      const journalEntry = await prisma.journalEntry.findFirst({
        where: { id: journalEntryId, companyId },
      });

      if (!journalEntry) {
        throw new Error('Journal entry not found');
      }

      if (journalEntry.isApproved) {
        throw new Error('Journal entry is already approved');
      }

      if (journalEntry.isCancelled) {
        throw new Error('Cannot approve a cancelled journal entry');
      }

      // L1 fix (Item 41): this used to have no posted-state guard at all,
      // while `unapproveJournalEntry` below blocks once posted — an
      // inconsistent control pair that let a journal entry be approved
      // *after* it was already posted (a no-op sign-off with nothing left
      // to gate) with no way to undo it, since unapprove would then refuse.
      // Approval is a pre-posting gate for journal entries (see
      // `approval-workflow.service.ts`'s APPROVED → canPost model), so it
      // must be rejected once posted, symmetric with unapprove.
      if (journalEntry.isPosted) {
        throw new Error('Cannot approve a posted journal entry');
      }

      const updated = await prisma.journalEntry.update({
        where: { id: journalEntryId },
        data: { isApproved: true },
      });

      logger.info({ companyId, journalEntryId }, 'Journal entry approved');
      return updated;
    } catch (error) {
      logger.error(
        { error, companyId, journalEntryId },
        'Error approving journal entry'
      );
      throw error;
    }
  }

  /**
   * Unapprove journal entry
   */
  async unapproveJournalEntry(companyId: string, journalEntryId: string) {
    try {
      const journalEntry = await prisma.journalEntry.findFirst({
        where: { id: journalEntryId, companyId },
      });

      if (!journalEntry) {
        throw new AppError(404, 'القيد غير موجود');
      }

      if (!journalEntry.isApproved) {
        return journalEntry;
      }

      if (journalEntry.isPosted) {
        throw new AppError(
          400,
          'القيد مرحّل. فك الترحيل أولاً من قائمة (...) ثم ألغِ الاعتماد.'
        );
      }

      const updated = await prisma.journalEntry.update({
        where: { id: journalEntryId },
        data: { isApproved: false },
      });

      logger.info({ companyId, journalEntryId }, 'Journal entry unapproved');
      return updated;
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error(
          { error, companyId, journalEntryId },
          'Error unapproving journal entry'
        );
      }
      throw error;
    }
  }

  /**
   * Cancel journal entry
   */
  async cancelJournalEntry(companyId: string, journalEntryId: string) {
    const journalEntry = await prisma.journalEntry.findFirst({
      where: { id: journalEntryId, companyId },
    });

    if (!journalEntry) {
      throw new AppError(404, 'القيد غير موجود');
    }

    if (journalEntry.isCancelled) {
      throw new AppError(400, 'القيد ملغي بالفعل');
    }

    if (journalEntry.isPosted) {
      throw new AppError(
        422,
        'القيد مرحّل. ألغِ الترحيل أولاً من قائمة (...) ثم أعد الإلغاء.'
      );
    }

    const updated = await prisma.journalEntry.update({
      where: { id: journalEntryId },
      data: { isCancelled: true },
    });

    logger.info({ companyId, journalEntryId }, 'Journal entry cancelled');
    return updated;
  }

  /**
   * Restore a cancelled journal entry. Opening balance stays on the same
   * unposted document; other journals are posted again after restore.
   */
  async restoreJournalEntry(
    companyId: string,
    journalEntryId: string,
    context?: { branchId?: string; fiscalYearId?: string; userId?: string; isAdmin?: boolean }
  ) {
    const journalEntry = await prisma.journalEntry.findFirst({
      where: { id: journalEntryId, companyId },
    });

    if (!journalEntry) {
      throw new AppError(404, 'القيد غير موجود');
    }

    if (!journalEntry.isCancelled) {
      throw new AppError(400, 'القيد ليس ملغياً');
    }

    if (journalEntry.entryType === 'OPENING_BALANCE') {
      const otherOpening = await prisma.journalEntry.findFirst({
        where: {
          companyId,
          entryType: 'OPENING_BALANCE',
          isCancelled: false,
          id: { not: journalEntryId },
        },
        select: { id: true },
      });
      if (otherOpening) {
        throw new AppError(
          409,
          'يوجد قيد افتتاحي نشط بالفعل. ألغِ الجديد أولاً ثم استرجع الملغي.'
        );
      }
    }

    const restored = await prisma.journalEntry.update({
      where: { id: journalEntryId },
      data: {
        isCancelled: false,
      },
    });

    if (journalEntry.entryType === 'OPENING_BALANCE') {
      logger.info({ companyId, journalEntryId }, 'Opening balance journal restored');
      return restored;
    }

    try {
      const posted = await this.postJournalEntry(companyId, journalEntryId, context);
      logger.info({ companyId, journalEntryId }, 'Journal entry restored and posted');
      return posted;
    } catch (error) {
      logger.warn(
        { error, companyId, journalEntryId },
        'Journal entry restored as draft; posting failed'
      );
      const reason = error instanceof Error ? error.message : 'تعذر الترحيل';
      throw new AppError(
        error instanceof AppError ? error.statusCode : 422,
        `تم استعادة القيد كمسودة وتعذر الترحيل: ${reason}`
      );
    }
  }

  /**
   * Delete journal entry (soft delete - cancel if not posted)
   */
  async deleteJournalEntry(companyId: string, journalEntryId: string) {
    try {
      const journalEntry = await prisma.journalEntry.findFirst({
        where: { id: journalEntryId, companyId },
      });

      if (!journalEntry) {
        throw new Error('Journal entry not found');
      }

      if (journalEntry.isPosted) {
        throw new Error('Cannot delete a posted journal entry');
      }

      // Cancel the journal entry instead of hard delete
      await prisma.journalEntry.update({
        where: { id: journalEntryId },
        data: { isCancelled: true },
      });

      logger.info({ companyId, journalEntryId }, 'Journal entry deleted');
      return { success: true };
    } catch (error) {
      logger.error(
        { error, companyId, journalEntryId },
        'Error deleting journal entry'
      );
      throw error;
    }
  }
}

export const journalEntryService = new JournalEntryService();
