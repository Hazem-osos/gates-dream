import prisma from '../../../shared/database/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalPostingService } from './journal-posting.service';
import { commercialPaperPostingService } from './commercial-paper-posting.service';
import {
  assertPaperIssued,
  SECURITIES_PAPER_CASES,
} from '../utils/securities-paper-case';
import { resolveSecuritiesPaperNumbers } from '../utils/securities-numbering';

export type CollectSecuritiesInput = {
  accountId: string;
  date?: Date;
  description?: string;
  costCenterId?: string | null;
};

/** Minimal context needed to post a real GL entry for a securities receipt (H11). */
export interface SecuritiesPostingCtx {
  branchId?: string | null;
  userId: string;
}

export interface CreateSecuritiesReceiptData {
  branchId?: string;
  serial?: string;
  receiptNumber?: string;
  date: Date;
  hijriDate?: string;
  description?: string;
  securityType: 'check' | 'promissory-note' | 'bond' | 'other';
  customerId?: string;
  supplierId?: string;
  destinationAccountId?: string | null;
  issuerName?: string;
  issuerBank?: string;
  securityNumber?: string;
  dueDate?: Date;
  amount: number;
  currencyCode: string;
  entityName?: string | null;
}

export interface UpdateSecuritiesReceiptData {
  branchId?: string;
  serial?: string;
  receiptNumber?: string;
  date?: Date;
  hijriDate?: string;
  description?: string;
  securityType?: 'check' | 'promissory-note' | 'bond' | 'other';
  customerId?: string;
  supplierId?: string;
  destinationAccountId?: string | null;
  issuerName?: string;
  issuerBank?: string;
  securityNumber?: string;
  dueDate?: Date;
  amount?: number;
  currencyCode?: string;
  entityName?: string | null;
}

export class SecuritiesReceiptService {
  /**
   * Get all securities receipts for a company
   */
  async getSecuritiesReceipts(
    companyId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      securityType?: string;
      customerId?: string;
      supplierId?: string;
      isPosted?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (options?.startDate || options?.endDate) {
      where.date = {};
      if (options.startDate) where.date.gte = options.startDate;
      if (options.endDate) where.date.lte = options.endDate;
    }

    if (options?.securityType) {
      where.securityType = options.securityType;
    }

    if (options?.customerId) {
      where.customerId = options.customerId;
    }

    if (options?.supplierId) {
      where.supplierId = options.supplierId;
    }

    if (options?.isPosted !== undefined) {
      where.isPosted = options.isPosted;
    }

    const [receipts, total] = await Promise.all([
      prisma.securitiesReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          customer: { select: { id: true, arabicName: true, code: true } },
          supplier: { select: { id: true, arabicName: true, code: true } },
        },
      }),
      prisma.securitiesReceipt.count({ where }),
    ]);

    return {
      receipts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single securities receipt by ID
   */
  async getSecuritiesReceiptById(
    companyId: string,
    receiptId: string,
    ctx?: SecuritiesPostingCtx
  ) {
    const receipt = await prisma.securitiesReceipt.findFirst({
      where: {
        id: receiptId,
        companyId,
      },
      include: {
        customer: true,
        supplier: true,
      },
    });

    if (!receipt) {
      throw new AppError(404, 'ورقة المقبوضات غير موجودة');
    }

    if (ctx?.userId) {
      return commercialPaperPostingService.ensureIssueJournalIfMissing(
        { companyId, branchId: ctx.branchId ?? receipt.branchId, userId: ctx.userId },
        'RECEIPT',
        receiptId
      );
    }
    return commercialPaperPostingService.decoratePaper(companyId, 'RECEIPT', receipt);
  }

  /**
   * Create a new securities receipt
   */
  async createSecuritiesReceipt(
    companyId: string,
    data: CreateSecuritiesReceiptData,
    ctx?: SecuritiesPostingCtx
  ) {
    if (!data.customerId && !data.supplierId && !data.destinationAccountId) {
      throw new Error('اختر العميل أو حساباً آخر');
    }
    if (data.destinationAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: data.destinationAccountId, companyId },
        select: { id: true },
      });
      if (!account) throw new AppError(400, 'الحساب المختار غير موجود');
    }

    const { serial, documentNumber: receiptNumber } = await resolveSecuritiesPaperNumbers({
      companyId,
      kind: 'RECEIPT',
      serial: data.serial,
      documentNumber: data.receiptNumber,
      allocate: () =>
        documentSequenceService.nextNumberForFamily({
          companyId,
          branchId: data.branchId ?? null,
          fiscalYearId: null,
          docType: 'CK',
          legacySuffix: 'CK01',
          seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
            const rows = await prisma.securitiesReceipt.findMany({
              where: { companyId },
              select: { receiptNumber: true },
            });
            return rows.map((r) => r.receiptNumber);
          }),
          isAvailable: async (candidate) => {
            const taken = await prisma.securitiesReceipt.findFirst({
              where: { companyId, receiptNumber: candidate },
              select: { id: true },
            });
            return !taken;
          },
        }),
    });

    const existing = await prisma.securitiesReceipt.findFirst({
      where: { companyId, receiptNumber },
      select: { id: true },
    });
    if (existing) {
      throw new Error('Receipt number already exists');
    }

    const created = await prisma.securitiesReceipt.create({
      data: {
        companyId,
        branchId: data.branchId,
        serial,
        receiptNumber,
        date: data.date,
        hijriDate: data.hijriDate,
        description: data.description,
        securityType: data.securityType,
        customerId: data.customerId,
        supplierId: data.supplierId,
        destinationAccountId: data.destinationAccountId,
        issuerName: data.issuerName,
        issuerBank: data.issuerBank,
        securityNumber: data.securityNumber,
        dueDate: data.dueDate,
        amount: new Decimal(data.amount),
        currencyCode: data.currencyCode,
        entityName: data.entityName,
        isReceived: true,
        isPosted: false,
        isApproved: false,
        isCancelled: false,
        paperCase: SECURITIES_PAPER_CASES.ISSUED,
      },
    });
    if (!ctx?.userId) {
      return commercialPaperPostingService.decoratePaper(companyId, 'RECEIPT', created);
    }
    try {
      return await commercialPaperPostingService.syncIssueJournal(
        { companyId, branchId: ctx.branchId ?? data.branchId, userId: ctx.userId },
        'RECEIPT',
        created.id
      );
    } catch (error) {
      await prisma.securitiesReceipt.delete({ where: { id: created.id } }).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Update a securities receipt
   */
  async updateSecuritiesReceipt(
    companyId: string,
    receiptId: string,
    data: UpdateSecuritiesReceiptData,
    ctx?: SecuritiesPostingCtx
  ) {
    const receipt = await this.getSecuritiesReceiptById(companyId, receiptId);

    if (receipt.isPosted) {
      throw new AppError(400, 'فك الترحيل أولاً قبل تعديل الورقة');
    }
    if (receipt.isCancelled) {
      throw new AppError(400, 'لا يمكن تعديل ورقة ملغاة');
    }
    assertPaperIssued(receipt, 'تعديل الورقة');

    // Check receipt number uniqueness if changing
    if (data.receiptNumber && data.receiptNumber !== receipt.receiptNumber) {
      const existing = await prisma.securitiesReceipt.findFirst({
        where: {
          companyId,
          receiptNumber: data.receiptNumber,
          id: { not: receiptId },
        },
      });

      if (existing) {
        throw new Error('Receipt number already exists');
      }
    }

    const updateData: any = {};
    if (data.branchId !== undefined) updateData.branchId = data.branchId;
    if (data.serial !== undefined) updateData.serial = data.serial;
    if (data.receiptNumber !== undefined) updateData.receiptNumber = data.receiptNumber;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.hijriDate !== undefined) updateData.hijriDate = data.hijriDate;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.securityType !== undefined) updateData.securityType = data.securityType;
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.destinationAccountId !== undefined) updateData.destinationAccountId = data.destinationAccountId;
    if (data.issuerName !== undefined) updateData.issuerName = data.issuerName;
    if (data.issuerBank !== undefined) updateData.issuerBank = data.issuerBank;
    if (data.securityNumber !== undefined) updateData.securityNumber = data.securityNumber;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.currencyCode !== undefined) updateData.currencyCode = data.currencyCode;
    if (data.entityName !== undefined) updateData.entityName = data.entityName;

    const updated = await prisma.securitiesReceipt.update({
      where: { id: receiptId },
      data: updateData,
      include: { customer: true, supplier: true },
    });
    if (!ctx?.userId) {
      return commercialPaperPostingService.decoratePaper(companyId, 'RECEIPT', updated);
    }
    return commercialPaperPostingService.syncIssueJournal(
      { companyId, branchId: ctx.branchId ?? receipt.branchId, userId: ctx.userId },
      'RECEIPT',
      receiptId
    );
  }

  /**
   * Post a securities receipt (H11): receiving a check/promissory-note/bond from a
   * customer or supplier is a real accounting event — the instrument sits as an
   * asset ("notes in hand", reusing the Cheque module's account) until collected,
   * and the party's AR/AP balance is settled by it just as a cheque would.
   * Posts a real, reversible 2-line journal instead of flipping a flag.
   */
  async postSecuritiesReceipt(companyId: string, receiptId: string, ctx: SecuritiesPostingCtx) {
    return commercialPaperPostingService.postPaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      'RECEIPT',
      receiptId
    );
  }

  /**
   * Collect (تحصيل): cash/bank the user picked vs the party — not the unused
   * cheque-defaults path. Immediate collection of an unposted paper.
   */
  async collectSecuritiesReceipt(
    companyId: string,
    receiptId: string,
    ctx: SecuritiesPostingCtx,
    input: CollectSecuritiesInput
  ) {
    return commercialPaperPostingService.collectPaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      'RECEIPT',
      receiptId,
      input
    );
  }

  /**
   * Unpost a securities receipt (H11): reverses the posting journal entry via a
   * dated contra entry and restores the party balance, mirroring cheque unpost.
   */
  async unpostSecuritiesReceipt(companyId: string, receiptId: string, ctx: SecuritiesPostingCtx) {
    return commercialPaperPostingService.unpostPaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      'RECEIPT',
      receiptId
    );
  }

  /**
   * Bounce (ارتداد): reverse posting if needed, then cancel the paper.
   */
  async bounceSecuritiesReceipt(
    companyId: string,
    receiptId: string,
    ctx: SecuritiesPostingCtx,
    input: { description?: string; date?: Date; accountId?: string } = {}
  ) {
    return commercialPaperPostingService.bouncePaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      'RECEIPT',
      receiptId,
      input
    );
  }

  /**
   * Endorse (تظهير) an unposted receipt paper to a supplier.
   */
  async endorseSecuritiesReceipt(
    companyId: string,
    receiptId: string,
    ctx: SecuritiesPostingCtx,
    input: { supplierId: string; description?: string; date?: Date }
  ) {
    return commercialPaperPostingService.endorsePaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      receiptId,
      input
    );
  }

  async unendorseSecuritiesReceipt(companyId: string, receiptId: string, ctx: SecuritiesPostingCtx) {
    return commercialPaperPostingService.unendorsePaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      receiptId
    );
  }

  /**
   * Cancel a securities receipt
   */
  async cancelSecuritiesReceipt(companyId: string, receiptId: string) {
    const receipt = await this.getSecuritiesReceiptById(companyId, receiptId);

    if (receipt.isPosted) {
      throw new Error('Cannot cancel a posted securities receipt. Unpost it first.');
    }

    if (receipt.isCancelled) {
      throw new Error('Securities receipt is already cancelled');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.cascadeSourceJournalInTx(
        tx,
        companyId,
        [receipt.journalEntryId],
        'cancel',
        undefined,
        { sourceId: receipt.id, sourceNumber: receipt.receiptNumber ?? receipt.serial ?? undefined }
      );
      return tx.securitiesReceipt.update({
        where: { id: receiptId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          paperCase: SECURITIES_PAPER_CASES.BOUNCED,
        },
      });
    });
  }

  /**
   * Restore a cancelled securities receipt
   */
  async restoreSecuritiesReceipt(companyId: string, receiptId: string, ctx: SecuritiesPostingCtx) {
    return commercialPaperPostingService.restorePaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      'RECEIPT',
      receiptId
    );
  }
}

export const securitiesReceiptService = new SecuritiesReceiptService();

