import prisma from '../../../shared/database/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { AppError } from '../../../shared/middleware/error-handler';
import { assertPaperDueOnOrAfterIssue } from '../utils/paper-due-date';
import { commercialPaperPostingService } from './commercial-paper-posting.service';
import {
  companyOpeningJournalIsPosted,
  OPENING_JOURNAL_UNPOST_FIRST_MESSAGE,
} from './opening-balance.service';
import {
  assertPaperIssued,
  SECURITIES_PAPER_CASES,
} from '../utils/securities-paper-case';
import { resolveSecuritiesPaperNumbers } from '../utils/securities-numbering';
import { resolveSecuritiesEntity } from './securities-entity.service';
import { normalizeInvoiceAllocations, type InvoiceAllocationInput } from '../utils/invoice-allocations';
import { attachPartyDisplayNames } from '../utils/paper-party-label';
import {
  acquireUniqueKey,
  releaseUniqueKeyIfUnused,
  UNIQUE_KINDS,
} from '../../../shared/database/company-unique-key';

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
  partyAccountId?: string | null;
  depositAccountId?: string | null;
  depositDate?: Date | null;
  issuerName?: string;
  issuerBank?: string;
  securityNumber?: string;
  dueDate?: Date;
  amount: number;
  currencyCode: string;
  entityName?: string | null;
  entityId?: string | null;
  allocations?: InvoiceAllocationInput[];
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
  partyAccountId?: string | null;
  depositAccountId?: string | null;
  depositDate?: Date | null;
  issuerName?: string;
  issuerBank?: string;
  securityNumber?: string;
  dueDate?: Date;
  amount?: number;
  currencyCode?: string;
  entityName?: string | null;
  entityId?: string | null;
  allocations?: InvoiceAllocationInput[];
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
      entityId?: string;
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
    if (options?.entityId) {
      where.entityId = options.entityId;
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
          entity: { select: { id: true, arabicName: true } },
        },
      }),
      prisma.securitiesReceipt.count({ where }),
    ]);

    const named = await attachPartyDisplayNames(receipts, (ids) =>
      prisma.account.findMany({
        where: { companyId, id: { in: ids } },
        select: { id: true, code: true, arabicName: true },
      })
    );

    return {
      receipts: named,
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
        entity: { select: { id: true, arabicName: true } },
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
    if (!data.customerId && !data.supplierId && !data.partyAccountId) {
      throw new AppError(422, 'اختر العميل أو حساب حركة قبل حفظ ورقة المقبوضات');
    }
    assertPaperDueOnOrAfterIssue(data.date, data.dueDate);
    const destinationAccountId =
      data.destinationAccountId ||
      (await commercialPaperPostingService.resolveDefaultNotesAccount(companyId, 'RECEIPT'));
    const account = await prisma.account.findFirst({
      where: { id: destinationAccountId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!account) throw new AppError(400, 'الحساب المختار غير موجود');

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

    const entity = await resolveSecuritiesEntity(companyId, {
      entityId: data.entityId,
      entityName: data.entityName,
    });

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.securitiesReceipt.findFirst({
        where: { companyId, receiptNumber },
        select: { id: true },
      });
      if (existing) {
        throw new AppError(409, 'رقم ورقة المقبوضات مستخدم');
      }
      const securityNumber = await acquireUniqueKey(
        tx,
        companyId,
        UNIQUE_KINDS.chequeNumber,
        data.securityNumber
      );
      return tx.securitiesReceipt.create({
      data: {
        companyId,
        branchId: data.branchId ?? ctx?.branchId,
        serial,
        receiptNumber,
        date: data.date,
        hijriDate: data.hijriDate,
        description: data.description,
        securityType: data.securityType,
        customerId: data.customerId,
        supplierId: data.supplierId,
        destinationAccountId,
        partyAccountId: data.partyAccountId || null,
        depositAccountId: data.depositAccountId || null,
        depositDate: data.depositDate || null,
        issuerName: data.issuerName,
        issuerBank: data.issuerBank,
        securityNumber,
        dueDate: data.dueDate,
        amount: new Decimal(data.amount),
        currencyCode: data.currencyCode,
        entityId: entity?.id,
        entityName: entity?.arabicName ?? data.entityName,
        invoiceAllocations: normalizeInvoiceAllocations(data.allocations),
        isReceived: true,
        isPosted: false,
        isApproved: false,
        isCancelled: false,
        paperCase: SECURITIES_PAPER_CASES.ISSUED,
      },
      });
    });
    if (!ctx?.userId) {
      return commercialPaperPostingService.decoratePaper(companyId, 'RECEIPT', created);
    }
    try {
      return await commercialPaperPostingService.syncIssueAndOptionalDeposit(
        { companyId, branchId: ctx.branchId ?? data.branchId ?? created.branchId, userId: ctx.userId },
        created.id,
        { accountId: data.depositAccountId, date: data.depositDate }
      );
    } catch (error) {
      await prisma
        .$transaction(async (tx) => {
          await tx.securitiesReceipt.delete({ where: { id: created.id } });
          await releaseUniqueKeyIfUnused(tx, companyId, UNIQUE_KINDS.chequeNumber, created.securityNumber);
        })
        .catch(() => undefined);
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

    if (receipt.isCancelled) {
      throw new AppError(400, 'لا يمكن تعديل ورقة ملغاة');
    }
    if (receipt.isOpening && (await companyOpeningJournalIsPosted(companyId))) {
      throw new AppError(400, OPENING_JOURNAL_UNPOST_FIRST_MESSAGE);
    }
    assertPaperIssued(receipt, 'تعديل الورقة');
    assertPaperDueOnOrAfterIssue(
      data.date ?? receipt.date,
      data.dueDate !== undefined ? data.dueDate : receipt.dueDate
    );

    // Check receipt number uniqueness if changing
    if (data.receiptNumber && data.receiptNumber !== (receipt as { receiptNumber?: string | null }).receiptNumber) {
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
    if (data.partyAccountId !== undefined) updateData.partyAccountId = data.partyAccountId;
    if (data.depositAccountId !== undefined) updateData.depositAccountId = data.depositAccountId;
    if (data.depositDate !== undefined) updateData.depositDate = data.depositDate;
    if (data.issuerName !== undefined) updateData.issuerName = data.issuerName;
    if (data.issuerBank !== undefined) updateData.issuerBank = data.issuerBank;
    if (data.securityNumber !== undefined) {
      updateData.securityNumber = data.securityNumber.trim() || null;
    }
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.currencyCode !== undefined) updateData.currencyCode = data.currencyCode;
    if (data.entityId !== undefined || data.entityName !== undefined) {
      const entity = await resolveSecuritiesEntity(companyId, {
        entityId: data.entityId,
        entityName: data.entityName,
      });
      updateData.entityId = entity?.id ?? null;
      updateData.entityName = entity?.arabicName ?? data.entityName ?? null;
    }
    if (data.allocations !== undefined) {
      updateData.invoiceAllocations = normalizeInvoiceAllocations(data.allocations);
    }

    const nextNumber =
      data.securityNumber !== undefined ? (updateData.securityNumber as string | null) : undefined;
    const previousNumber = receipt.securityNumber?.trim() || null;
    const updated = await prisma.$transaction(async (tx) => {
      if (nextNumber && nextNumber !== previousNumber) {
        await acquireUniqueKey(tx, companyId, UNIQUE_KINDS.chequeNumber, nextNumber);
      }
      const row = await tx.securitiesReceipt.update({
        where: { id: receiptId },
        data: updateData,
        include: { customer: true, supplier: true, entity: { select: { id: true, arabicName: true } } },
      });
      if (previousNumber && nextNumber !== undefined && nextNumber !== previousNumber) {
        await releaseUniqueKeyIfUnused(tx, companyId, UNIQUE_KINDS.chequeNumber, previousNumber);
      }
      return row;
    });
    if (!ctx?.userId) {
      return commercialPaperPostingService.decoratePaper(companyId, 'RECEIPT', updated);
    }
    if (updated.isOpening) {
      return commercialPaperPostingService.decoratePaper(companyId, 'RECEIPT', updated);
    }
    return commercialPaperPostingService.syncIssueAndOptionalDeposit(
      { companyId, branchId: ctx.branchId ?? receipt.branchId, userId: ctx.userId },
      receiptId,
      {
        accountId:
          data.depositAccountId !== undefined ? data.depositAccountId : updated.depositAccountId,
        date: data.depositDate !== undefined ? data.depositDate : updated.depositDate,
      }
    );
  }

  async depositSecuritiesReceipt(
    companyId: string,
    receiptId: string,
    ctx: SecuritiesPostingCtx,
    input: { accountId?: string | null; date?: Date | null }
  ) {
    const receipt = await this.getSecuritiesReceiptById(companyId, receiptId);
    if (receipt.isCancelled || receipt.paperCase === SECURITIES_PAPER_CASES.BOUNCED) {
      throw new AppError(400, 'لا يمكن إيداع ورقة مرتدة أو ملغاة');
    }
    if (
      receipt.paperCase === SECURITIES_PAPER_CASES.COLLECTED ||
      receipt.paperCase === SECURITIES_PAPER_CASES.MULTI_COLLECTED ||
      receipt.paperCase === SECURITIES_PAPER_CASES.ENDORSED
    ) {
      throw new AppError(400, 'لا يمكن تغيير الإيداع بعد التحصيل أو التظهير');
    }
    return commercialPaperPostingService.syncDepositJournal(
      { companyId, branchId: ctx.branchId ?? receipt.branchId, userId: ctx.userId },
      receiptId,
      { accountId: input.accountId, date: input.date }
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

  async uncollectSecuritiesReceipt(companyId: string, receiptId: string, ctx: SecuritiesPostingCtx) {
    return commercialPaperPostingService.uncollectPaper(
      { companyId, branchId: ctx.branchId, userId: ctx.userId },
      'RECEIPT',
      receiptId
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
    input: { accountId: string; description?: string; date?: Date }
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
    if (receipt.isOpening) {
      throw new AppError(400, 'لا يمكن حذف شيك مسجّل في الأوراق المالية السابقة كمسودة');
    }
    return commercialPaperPostingService.cancelIssuedPaperJournals(
      { companyId, branchId: receipt.branchId, userId: '' },
      'RECEIPT',
      receiptId
    );
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

