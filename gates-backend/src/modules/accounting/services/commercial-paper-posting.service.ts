import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { toHijriDate } from '../../../shared/utils/hijri-date';
import type { ExecuteMultiCollectionDto } from '../../treasury/dto/commercial-paper.dto';
import type { JournalEntryLineData } from '../types/journal-entry.types';
import { journalPostingService } from './journal-posting.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { customerLedgerAccountService } from './customer-ledger-account.service';
import { resolveCompanyFxRate, toBaseAmount } from '../utils/company-fx-rate';
import {
  PAPER_JOURNAL_ENTRY_TYPE,
  PAPER_LIFECYCLE,
  buildEndorseLines,
  buildIssuedBounceLines,
  buildPaymentCollectLines,
  buildPaymentIssueLines,
  buildReceiptCollectLines,
  buildReceiptIssueLines,
  invertJournalLines,
  isLifecycleBeyondIssue,
  paperJournalLabel,
} from '../utils/commercial-paper-journals';
import { assertPaperIssued } from '../utils/securities-paper-case';

export type CommercialPaperKind = 'PAYMENT' | 'RECEIPT';

export interface CommercialPaperPostingCtx {
  companyId: string;
  branchId?: string | null;
  userId: string;
}

export interface PaperLifecycleInput {
  date?: Date;
  description?: string;
  accountId?: string;
  costCenterId?: string | null;
  supplierId?: string;
}

export type PaperJournalSummary = {
  id: string;
  entryType: string | null;
  label: string;
  voucherNumber: string | null;
  date: Date;
  description: string | null;
  isPosted: boolean;
  isCancelled: boolean;
  isReversal: boolean;
};

function asDate(value?: Date | string | null): Date {
  if (!value) return new Date();
  const next = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(next.getTime())) throw new AppError(400, 'التاريخ غير صالح');
  return next;
}

function money(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function paperNumberOf(paper: {
  paymentNumber?: string | null;
  receiptNumber?: string | null;
  id: string;
}): string {
  return paper.paymentNumber || paper.receiptNumber || paper.id;
}

function sourceTypeOf(kind: CommercialPaperKind): 'SECP' | 'SECR' {
  return kind === 'PAYMENT' ? 'SECP' : 'SECR';
}

export class CommercialPaperPostingService {
  private postingCtx(ctx: CommercialPaperPostingCtx, fiscalYearId: string) {
    const branchId = ctx.branchId?.trim();
    if (!branchId) {
      throw new AppError(422, 'حدد الفرع قبل إنشاء قيد الورقة');
    }
    return {
      companyId: ctx.companyId,
      branchId,
      fiscalYearId,
      userId: ctx.userId,
    };
  }

  private async withResolvedBranch(
    ctx: CommercialPaperPostingCtx,
    paperBranchId?: string | null
  ): Promise<CommercialPaperPostingCtx> {
    const preferred = [ctx.branchId, paperBranchId]
      .map((id) => id?.trim())
      .find((id): id is string => Boolean(id));
    if (preferred) {
      const match = await prisma.branch.findFirst({
        where: { id: preferred, companyId: ctx.companyId, deletedAt: null },
        select: { id: true },
      });
      if (match) return { ...ctx, branchId: match.id };
    }
    const fallback = await prisma.branch.findFirst({
      where: { companyId: ctx.companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!fallback) {
      throw new AppError(422, 'أضف فرعاً من إعدادات الشركة قبل إنشاء قيد الورقة');
    }
    return { ...ctx, branchId: fallback.id };
  }

  private async loadPaper(companyId: string, paperKind: CommercialPaperKind, paperId: string) {
    const paper =
      paperKind === 'PAYMENT'
        ? await prisma.securitiesPayment.findFirst({ where: { id: paperId, companyId } })
        : await prisma.securitiesReceipt.findFirst({ where: { id: paperId, companyId } });
    if (!paper) {
      throw new AppError(404, paperKind === 'PAYMENT' ? 'ورقة المدفوعات غير موجودة' : 'ورقة المقبوضات غير موجودة');
    }
    return paper;
  }

  private async notesAccountId(
    companyId: string,
    paperKind: CommercialPaperKind,
    selectedId?: string | null
  ): Promise<string> {
    const chosen = selectedId?.trim();
    if (chosen) {
      const account = await prisma.account.findFirst({
        where: { id: chosen, companyId, deletedAt: null },
        select: { id: true },
      });
      if (account) return account.id;
    }
    return this.resolveDefaultNotesAccount(companyId, paperKind);
  }

  async resolveDefaultNotesAccount(companyId: string, paperKind: CommercialPaperKind): Promise<string> {
    const documentType = paperKind === 'PAYMENT' ? 'SECURITIES_PAYMENT' : 'SECURITIES_RECEIPT';
    const settings = await prisma.transactionSettings.findFirst({
      where: { companyId, documentType },
      select: { defaultOffsetAccountId: true },
    });
    if (settings?.defaultOffsetAccountId) {
      const configured = await prisma.account.findFirst({
        where: { id: settings.defaultOffsetAccountId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (configured) return configured.id;
    }
    const accounts = await treasuryAccountResolverService.resolveChequeAccounts(companyId);
    return paperKind === 'PAYMENT' ? accounts.notesPayableAccountId : accounts.chequesUnderHandAccountId;
  }

  private async partyAccountId(
    companyId: string,
    paperKind: CommercialPaperKind,
    paper: {
      customerId?: string | null;
      supplierId?: string | null;
    },
    overrideSupplierId?: string | null
  ) {
    const customerId = paper.customerId;
    const supplierId = overrideSupplierId ?? paper.supplierId;
    if (customerId) {
      return customerLedgerAccountService.ensureForCustomer({ companyId, customerId });
    }
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, companyId },
        select: { mainAccountId: true, accountId: true },
      });
      const accountId = supplier?.mainAccountId ?? supplier?.accountId;
      if (!accountId) {
        throw new AppError(422, 'اربط حساباً في كارت المورد قبل إنشاء قيد الورقة');
      }
      return accountId;
    }
    throw new AppError(
      422,
      paperKind === 'PAYMENT' ? 'اختر المورد قبل إنشاء قيد الورقة' : 'اختر العميل قبل إنشاء قيد الورقة'
    );
  }

  private async applyPartyBalances(
    tx: Prisma.TransactionClient,
    paperKind: CommercialPaperKind,
    paper: { customerId?: string | null; supplierId?: string | null },
    baseAmount: number,
    invert: boolean
  ) {
    const amount = new Decimal(baseAmount);
    const receiptDir = invert ? 'increment' : 'decrement';
    const paymentDir = invert ? 'decrement' : 'increment';
    if (paper.customerId) {
      await tx.customer.update({
        where: { id: paper.customerId },
        data: { balance: { [paperKind === 'RECEIPT' ? receiptDir : paymentDir]: amount } },
      });
    }
    if (paper.supplierId) {
      await tx.supplier.update({
        where: { id: paper.supplierId },
        data: { balance: { [paperKind === 'RECEIPT' ? paymentDir : receiptDir]: amount } },
      });
    }
  }

  private async isJournalActive(companyId: string, journalEntryId?: string | null): Promise<boolean> {
    if (!journalEntryId) return false;
    const [entry, reversal] = await Promise.all([
      prisma.journalEntry.findFirst({
        where: { id: journalEntryId, companyId, deletedAt: null, isCancelled: false },
        select: { id: true },
      }),
      prisma.journalEntry.findFirst({
        where: { reversalOfJournalEntryId: journalEntryId, companyId },
        select: { id: true },
      }),
    ]);
    return Boolean(entry && !reversal);
  }

  private issuedAfterUndoPatch() {
    return {
      paperCase: PAPER_LIFECYCLE.ISSUED,
      isPosted: false,
      postedAt: null as Date | null,
      isCancelled: false,
      cancelledAt: null as Date | null,
      commissionAmount: null,
      commissionAccountId: null,
    };
  }

  private async cancelActiveJournalsOfType(
    tx: Prisma.TransactionClient,
    ctx: CommercialPaperPostingCtx,
    paperId: string,
    entryTypes: string[]
  ) {
    const journals = await tx.journalEntry.findMany({
      where: {
        companyId: ctx.companyId,
        sourceId: paperId,
        deletedAt: null,
        isCancelled: false,
        entryType: { in: entryTypes },
      },
      select: { id: true, reversalOfJournalEntryId: true },
    });
    const ids = journals
      .filter((row) => !row.reversalOfJournalEntryId)
      .map((row) => row.id);
    if (!ids.length) return;
    await journalPostingService.cascadeSourceJournalInTx(
      tx,
      ctx.companyId,
      ids,
      'cancel',
      ctx.userId
    );
  }

  private async reverseActiveJournalsOfType(
    tx: Prisma.TransactionClient,
    ctx: CommercialPaperPostingCtx,
    paperId: string,
    entryTypes: string[],
    reason: string
  ) {
    ctx = await this.withResolvedBranch(ctx);
    const journals = await tx.journalEntry.findMany({
      where: {
        companyId: ctx.companyId,
        sourceId: paperId,
        deletedAt: null,
        entryType: { in: entryTypes },
      },
      select: { id: true, reversalOfJournalEntryId: true, isCancelled: true },
    });
    const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, new Date());
    for (const je of journals) {
      if (je.reversalOfJournalEntryId || je.isCancelled) continue;
      if (!(await this.isJournalActive(ctx.companyId, je.id))) continue;
      await journalPostingService.reverseJournalEntryInTx(tx, this.postingCtx(ctx, fiscalYearId), je.id, {
        reason,
      });
    }
  }

  private async updatePaper(
    paperKind: CommercialPaperKind,
    paperId: string,
    data: Prisma.SecuritiesReceiptUpdateInput | Prisma.SecuritiesPaymentUpdateInput,
    tx: Prisma.TransactionClient = prisma
  ) {
    if (paperKind === 'PAYMENT') {
      return tx.securitiesPayment.update({
        where: { id: paperId },
        data: data as Prisma.SecuritiesPaymentUpdateInput,
        include: { customer: true, supplier: true },
      });
    }
    return tx.securitiesReceipt.update({
      where: { id: paperId },
      data: data as Prisma.SecuritiesReceiptUpdateInput,
      include: { customer: true, supplier: true },
    });
  }

  private async postPaperJournal(
    tx: Prisma.TransactionClient,
    ctx: CommercialPaperPostingCtx,
    params: {
      paperKind: CommercialPaperKind;
      paper: {
        id: string;
        date: Date;
        currencyCode: string;
        branchId?: string | null;
        paymentNumber?: string | null;
        receiptNumber?: string | null;
        description?: string | null;
      };
      date: Date;
      description: string;
      entryType: string;
      lines: JournalEntryLineData[];
      claimActiveSourceKey: boolean;
    }
  ) {
    ctx = await this.withResolvedBranch(ctx, params.paper.branchId);
    const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, params.date);
    const { exchangeRate } = await resolveCompanyFxRate(ctx.companyId, params.paper.currencyCode);
    return journalPostingService.createAndPostInTx(tx, this.postingCtx(ctx, fiscalYearId), {
      fiscalYearId,
      date: params.date,
      hijriDate: toHijriDate(params.date),
      description: params.description,
      currencyCode: params.paper.currencyCode,
      exchangeRate,
      entryType: params.entryType,
      sourceType: sourceTypeOf(params.paperKind),
      sourceId: params.paper.id,
      sourceNumber: paperNumberOf(params.paper),
      claimActiveSourceKey: params.claimActiveSourceKey,
      lines: params.lines,
    });
  }

  async listJournals(companyId: string, paperKind: CommercialPaperKind, paperId: string): Promise<PaperJournalSummary[]> {
    const paper = await this.loadPaper(companyId, paperKind, paperId);
    const extraIds = [paper.journalEntryId].filter((id): id is string => Boolean(id));
    const rows = await prisma.journalEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ sourceId: paperId }, ...(extraIds.length ? [{ id: { in: extraIds } }] : [])],
      },
      select: {
        id: true,
        entryType: true,
        voucherNumber: true,
        legacyGlNum: true,
        date: true,
        description: true,
        isPosted: true,
        isCancelled: true,
        reversalOfJournalEntryId: true,
        createdAt: true,
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    const seen = new Set<string>();
    return rows
      .filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      })
      .map((row) => {
        const serial = row.voucherNumber || row.legacyGlNum || null;
        const baseLabel = paperJournalLabel(row.entryType, serial);
        return {
          id: row.id,
          entryType: row.entryType,
          label: row.isCancelled ? `${baseLabel} — ملغي` : baseLabel,
          voucherNumber: serial,
          date: row.date,
          description: row.description,
          isPosted: row.isPosted,
          isCancelled: row.isCancelled,
          isReversal: Boolean(row.reversalOfJournalEntryId) || row.entryType === 'REVERSAL',
        };
      });
  }

  async decoratePaper<T extends { id: string; journalEntryId?: string | null }>(
    companyId: string,
    paperKind: CommercialPaperKind,
    paper: T
  ) {
    const [journals, multiCollectionLines] = await Promise.all([
      this.listJournals(companyId, paperKind, paper.id),
      this.listLines(companyId, paperKind, paper.id),
    ]);
    return {
      ...paper,
      journals,
      multiCollectionLines,
      journalEntryId: paper.journalEntryId || journals.find((row) => !row.isReversal)?.id || null,
    };
  }

  /** Open-from-browse: create the missing issue journal without failing the GET. */
  async ensureIssueJournalIfMissing(
    ctx: CommercialPaperPostingCtx,
    paperKind: CommercialPaperKind,
    paperId: string
  ) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    if (paper.isCancelled || isLifecycleBeyondIssue(paper.paperCase)) {
      return this.decoratePaper(ctx.companyId, paperKind, paper);
    }
    if (await this.isJournalActive(ctx.companyId, paper.journalEntryId)) {
      return this.decoratePaper(ctx.companyId, paperKind, paper);
    }
    try {
      return await this.syncIssueJournal(ctx, paperKind, paperId);
    } catch {
      return this.decoratePaper(ctx.companyId, paperKind, paper);
    }
  }

  async syncIssueJournal(ctx: CommercialPaperPostingCtx, paperKind: CommercialPaperKind, paperId: string) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    ctx = await this.withResolvedBranch(ctx, paper.branchId);
    if (!paper.branchId && ctx.branchId) {
      await this.updatePaper(paperKind, paperId, { branchId: ctx.branchId });
      paper.branchId = ctx.branchId;
    }
    if (paper.isCancelled) {
      throw new AppError(400, 'لا يمكن إنشاء قيد تحرير لورقة ملغاة');
    }
    if (isLifecycleBeyondIssue(paper.paperCase)) {
      throw new AppError(400, 'لا يمكن تعديل قيد التحرير بعد حدث لاحق على الورقة');
    }
    if (!paper.customerId && !paper.supplierId) {
      throw new AppError(
        422,
        paperKind === 'PAYMENT'
          ? 'اختر المورد قبل إنشاء قيد التحرير'
          : 'اختر العميل قبل إنشاء قيد التحرير'
      );
    }

    const amount = money(Number(paper.amount));
    const { exchangeRate } = await resolveCompanyFxRate(ctx.companyId, paper.currencyCode);
    const baseAmount = toBaseAmount(amount, exchangeRate);
    const notesAccountId = await this.notesAccountId(
      ctx.companyId,
      paperKind,
      paper.destinationAccountId
    );
    const partyAccountId = await this.partyAccountId(ctx.companyId, paperKind, paper);
    const lines =
      paperKind === 'PAYMENT'
        ? buildPaymentIssueLines({ notesAccountId, partyAccountId, amount })
        : buildReceiptIssueLines({ notesAccountId, partyAccountId, amount });
    const number = paperNumberOf(paper);
    const title = paperKind === 'PAYMENT' ? 'ورقة مدفوعات' : 'ورقة مقبوضات';
    const hadActiveIssue = await this.isJournalActive(ctx.companyId, paper.journalEntryId);
    const previousIssue = hadActiveIssue
      ? await prisma.journalEntry.findFirst({
          where: { id: paper.journalEntryId!, companyId: ctx.companyId },
          include: { lines: { select: { debit: true } } },
        })
      : null;
    const previousBaseAmount = previousIssue
      ? toBaseAmount(
          money(previousIssue.lines.reduce((sum, line) => Math.max(sum, Number(line.debit) || 0), 0)),
          Number(previousIssue.exchangeRate) || exchangeRate
        )
      : baseAmount;

    const posted = await prisma.$transaction(async (tx) => {
      if (hadActiveIssue && paper.journalEntryId) {
        await journalPostingService.reverseJournalEntryInTx(
          tx,
          this.postingCtx(ctx, await fiscalYearService.assertOpenForDate(ctx.companyId, new Date())),
          paper.journalEntryId,
          { reason: 'تحديث قيد التحرير' }
        );
        await this.applyPartyBalances(tx, paperKind, paper, previousBaseAmount, true);
      }

      const je = await this.postPaperJournal(tx, ctx, {
        paperKind,
        paper,
        date: paper.date,
        description: paper.description || `تحرير ${title} ${number}`,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.ISSUE,
        lines,
        claimActiveSourceKey: true,
      });
      await this.applyPartyBalances(tx, paperKind, paper, baseAmount, false);

      const patch = {
        journalEntryId: je.id,
        paperCase: PAPER_LIFECYCLE.ISSUED,
        destinationAccountId: notesAccountId,
      };
      if (paperKind === 'PAYMENT') {
        return tx.securitiesPayment.update({
          where: { id: paper.id },
          data: patch,
          include: { customer: true, supplier: true },
        });
      }
      return tx.securitiesReceipt.update({
        where: { id: paper.id },
        data: patch,
        include: { customer: true, supplier: true },
      });
    });

    return this.decoratePaper(ctx.companyId, paperKind, posted);
  }

  async postPaper(ctx: CommercialPaperPostingCtx, paperKind: CommercialPaperKind, paperId: string) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    if (paper.isCancelled) throw new AppError(400, 'لا يمكن ترحيل ورقة ملغاة');
    if (paper.isPosted) throw new AppError(400, 'الورقة مرحّلة مسبقاً');
    if (isLifecycleBeyondIssue(paper.paperCase)) {
      throw new AppError(400, 'لا يمكن ترحيل الورقة بعد التحصيل أو الارتداد أو التظهير');
    }

    if (!(await this.isJournalActive(ctx.companyId, paper.journalEntryId))) {
      await this.syncIssueJournal(ctx, paperKind, paperId);
    }

    const posted =
      paperKind === 'PAYMENT'
        ? await prisma.securitiesPayment.update({
            where: { id: paperId },
            data: { isPosted: true, postedAt: new Date() },
            include: { customer: true, supplier: true },
          })
        : await prisma.securitiesReceipt.update({
            where: { id: paperId },
            data: { isPosted: true, postedAt: new Date() },
            include: { customer: true, supplier: true },
          });
    return this.decoratePaper(ctx.companyId, paperKind, posted);
  }

  async unpostPaper(ctx: CommercialPaperPostingCtx, paperKind: CommercialPaperKind, paperId: string) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    const paperCase = paper.paperCase || PAPER_LIFECYCLE.ISSUED;

    if (paperCase === PAPER_LIFECYCLE.COLLECTED || paperCase === PAPER_LIFECYCLE.MULTI_COLLECTED) {
      const isMulti = paperCase === PAPER_LIFECYCLE.MULTI_COLLECTED;
      const updated = await prisma.$transaction(async (tx) => {
        await this.cancelActiveJournalsOfType(
          tx,
          ctx,
          paper.id,
          isMulti
            ? [PAPER_JOURNAL_ENTRY_TYPE.MULTI, 'MULTI_COLLECTION']
            : [PAPER_JOURNAL_ENTRY_TYPE.COLLECT]
        );
        await tx.multiCollectionLine.deleteMany({
          where: { companyId: ctx.companyId, paperKind, paperId: paper.id },
        });
        return this.updatePaper(paperKind, paper.id, this.issuedAfterUndoPatch(), tx);
      });
      return this.decoratePaper(ctx.companyId, paperKind, updated);
    }

    if (!paper.isPosted) throw new AppError(400, 'الورقة غير مرحّلة');
    if (isLifecycleBeyondIssue(paperCase)) {
      throw new AppError(400, 'فك الحالة الحالية أولاً قبل أي إجراء آخر');
    }

    const updated = await this.updatePaper(paperKind, paperId, {
      isPosted: false,
      postedAt: null,
    });
    return this.decoratePaper(ctx.companyId, paperKind, updated);
  }

  async collectPaper(
    ctx: CommercialPaperPostingCtx,
    paperKind: CommercialPaperKind,
    paperId: string,
    input: PaperLifecycleInput
  ) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    if (paper.isCancelled) throw new AppError(400, 'لا يمكن تحصيل ورقة ملغاة');
    if (paper.paperCase !== PAPER_LIFECYCLE.ISSUED) {
      throw new AppError(400, 'الورقة محصّلة أو مغلقة مسبقاً');
    }
    if (!input.accountId) {
      throw new AppError(400, 'اختر حساب البنك');
    }

    const account = await prisma.account.findFirst({
      where: { id: input.accountId, companyId: ctx.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!account) throw new AppError(400, 'حساب التحصيل غير موجود');
    const bankLink = await prisma.bankAccount.findFirst({
      where: { companyId: ctx.companyId, glAccountId: input.accountId, isActive: true },
      select: { id: true },
    });
    if (!bankLink) throw new AppError(400, 'اختر حساب بنك من دليل البنوك');

    if (!(await this.isJournalActive(ctx.companyId, paper.journalEntryId))) {
      await this.syncIssueJournal(ctx, paperKind, paperId);
    }

    const amount = money(Number(paper.amount));
    const notesAccountId = await this.notesAccountId(
      ctx.companyId,
      paperKind,
      paper.destinationAccountId
    );
    const depositedAccountId =
      paperKind === 'RECEIPT' && 'depositAccountId' in paper
        ? paper.depositAccountId?.trim() || null
        : null;
    const creditAccountId = depositedAccountId || notesAccountId;
    const partyAccountId = await this.partyAccountId(ctx.companyId, paperKind, paper);
    const date = asDate(input.date);
    const lines =
      paperKind === 'PAYMENT'
        ? buildPaymentCollectLines({
            notesAccountId,
            partyAccountId,
            bankAccountId: input.accountId,
            amount,
            costCenterId: input.costCenterId,
            description: input.description,
          })
        : buildReceiptCollectLines({
            notesAccountId: creditAccountId,
            partyAccountId,
            bankAccountId: input.accountId,
            amount,
            costCenterId: input.costCenterId,
            description: input.description,
          });
    const number = paperNumberOf(paper);

    const posted = await prisma.$transaction(async (tx) => {
      await this.postPaperJournal(tx, ctx, {
        paperKind,
        paper,
        date,
        description: input.description || `تحصيل ورقة ${number}`,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.COLLECT,
        lines,
        claimActiveSourceKey: false,
      });
      const patch = {
        paperCase: PAPER_LIFECYCLE.COLLECTED,
        isPosted: true,
        postedAt: new Date(),
      };
      if (paperKind === 'PAYMENT') {
        return tx.securitiesPayment.update({
          where: { id: paper.id },
          data: patch,
          include: { customer: true, supplier: true },
        });
      }
      return tx.securitiesReceipt.update({
        where: { id: paper.id },
        data: {
          ...patch,
          destinationAccountId: paper.destinationAccountId || notesAccountId,
        },
        include: { customer: true, supplier: true },
      });
    });
    return this.decoratePaper(ctx.companyId, paperKind, posted);
  }

  async syncIssueAndOptionalDeposit(
    ctx: CommercialPaperPostingCtx,
    paperId: string,
    deposit?: { accountId?: string | null; date?: Date | null }
  ) {
    await this.syncIssueJournal(ctx, 'RECEIPT', paperId);
    return this.syncDepositJournal(ctx, paperId, deposit);
  }

  private async hasActiveJournalOfType(companyId: string, paperId: string, entryType: string) {
    const rows = await prisma.journalEntry.findMany({
      where: {
        companyId,
        sourceId: paperId,
        entryType,
        deletedAt: null,
        isCancelled: false,
      },
      select: { id: true, reversalOfJournalEntryId: true },
    });
    for (const row of rows) {
      if (row.reversalOfJournalEntryId) continue;
      if (await this.isJournalActive(companyId, row.id)) return true;
    }
    return false;
  }

  async syncDepositJournal(
    ctx: CommercialPaperPostingCtx,
    paperId: string,
    deposit?: { accountId?: string | null; date?: Date | null }
  ) {
    const depositAccountId = deposit?.accountId?.trim();
    if (!depositAccountId) {
      const paper = await this.loadPaper(ctx.companyId, 'RECEIPT', paperId);
      if (paper.paperCase !== PAPER_LIFECYCLE.ISSUED) {
        return this.decoratePaper(ctx.companyId, 'RECEIPT', paper);
      }
      const updated = await prisma.$transaction(async (tx) => {
        await this.cancelActiveJournalsOfType(tx, ctx, paper.id, [PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT]);
        return tx.securitiesReceipt.update({
          where: { id: paper.id },
          data: { depositAccountId: null, depositDate: null },
          include: { customer: true, supplier: true },
        });
      });
      return this.decoratePaper(ctx.companyId, 'RECEIPT', updated);
    }
    const paper = await this.loadPaper(ctx.companyId, 'RECEIPT', paperId);
    if (paper.paperCase !== PAPER_LIFECYCLE.ISSUED) {
      return this.decoratePaper(ctx.companyId, 'RECEIPT', paper);
    }
    if (await this.hasActiveJournalOfType(ctx.companyId, paper.id, PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT)) {
      return this.decoratePaper(ctx.companyId, 'RECEIPT', paper);
    }

    const account = await prisma.account.findFirst({
      where: { id: depositAccountId, companyId: ctx.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!account) throw new AppError(400, 'حساب الإيداع غير موجود');

    const amount = money(Number(paper.amount));
    const notesAccountId = await this.notesAccountId(
      ctx.companyId,
      'RECEIPT',
      paper.destinationAccountId
    );
    const date = asDate(deposit?.date ?? paper.date);
    const number = paperNumberOf(paper);
    const lines = buildReceiptCollectLines({
      notesAccountId,
      partyAccountId: notesAccountId,
      bankAccountId: depositAccountId,
      amount,
      description: `إيداع ورقة ${number} في البنك`,
    });

    const posted = await prisma.$transaction(async (tx) => {
      await this.postPaperJournal(tx, ctx, {
        paperKind: 'RECEIPT',
        paper,
        date,
        description: `إيداع ورقة ${number} في البنك`,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT,
        lines,
        claimActiveSourceKey: false,
      });
      return tx.securitiesReceipt.update({
        where: { id: paper.id },
        data: {
          destinationAccountId: paper.destinationAccountId || notesAccountId,
          depositAccountId,
          depositDate: date,
          paperCase: PAPER_LIFECYCLE.ISSUED,
        },
        include: { customer: true, supplier: true },
      });
    });
    return this.decoratePaper(ctx.companyId, 'RECEIPT', posted);
  }

  async bouncePaper(
    ctx: CommercialPaperPostingCtx,
    paperKind: CommercialPaperKind,
    paperId: string,
    input: PaperLifecycleInput
  ) {
    let paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    assertPaperIssued(paper, 'الارتداد');

    if (!(await this.isJournalActive(ctx.companyId, paper.journalEntryId))) {
      await this.syncIssueJournal(ctx, paperKind, paperId);
      paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    }

    const amount = money(Number(paper.amount));
    const { exchangeRate } = await resolveCompanyFxRate(ctx.companyId, paper.currencyCode);
    const baseAmount = toBaseAmount(amount, exchangeRate);
    const date = asDate(input.date);
    const number = paperNumberOf(paper);
    const note = input.description?.trim();

    const posted = await prisma.$transaction(async (tx) => {
      const invertTypes =
        paperKind === 'RECEIPT'
          ? [
              PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT,
              PAPER_JOURNAL_ENTRY_TYPE.ISSUE,
              'SecuritiesReceipt',
            ]
          : [PAPER_JOURNAL_ENTRY_TYPE.ISSUE, 'SecuritiesPayment'];
      const sources = await tx.journalEntry.findMany({
        where: {
          companyId: ctx.companyId,
          sourceId: paper.id,
          deletedAt: null,
          isCancelled: false,
          OR: [
            { entryType: { in: invertTypes } },
            ...(paper.journalEntryId ? [{ id: paper.journalEntryId }] : []),
          ],
        },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });

      const active: typeof sources = [];
      for (const journal of sources) {
        if (journal.reversalOfJournalEntryId) continue;
        const reversed = await tx.journalEntry.findFirst({
          where: { companyId: ctx.companyId, reversalOfJournalEntryId: journal.id },
          select: { id: true },
        });
        if (!reversed) active.push(journal);
      }

      const ordered = [
        ...active.filter((row) => row.entryType === PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT),
        ...active.filter((row) => row.entryType !== PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT),
      ];

      if (ordered.length === 0) {
        const notesAccountId = await this.notesAccountId(
          ctx.companyId,
          paperKind,
          paper.destinationAccountId
        );
        const partyAccountId = await this.partyAccountId(ctx.companyId, paperKind, paper);
        await this.postPaperJournal(tx, ctx, {
          paperKind,
          paper,
          date,
          description: note || `عكس قيد التحرير — ورقة ${number}`,
          entryType: PAPER_JOURNAL_ENTRY_TYPE.BOUNCE,
          lines: buildIssuedBounceLines(paperKind, {
            notesAccountId,
            partyAccountId,
            amount,
            description: note,
          }),
          claimActiveSourceKey: false,
        });
      } else {
        for (const source of ordered) {
          const label =
            source.entryType === PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT
              ? `عكس قيد الإيداع — ورقة ${number}`
              : `عكس قيد التحرير — ورقة ${number}`;
          await this.postPaperJournal(tx, ctx, {
            paperKind,
            paper,
            date,
            description: note ? `${label} — ${note}` : label,
            entryType: PAPER_JOURNAL_ENTRY_TYPE.BOUNCE,
            lines: invertJournalLines(
              source.lines.map((l) => ({
                ...l,
                debit: Number(l.debit),
                credit: Number(l.credit),
                exchangeRate: l.exchangeRate != null ? Number(l.exchangeRate) : null,
              }))
            ),
            claimActiveSourceKey: false,
          });
        }
      }

      await this.applyPartyBalances(tx, paperKind, paper, baseAmount, true);

      const patch = {
        paperCase: PAPER_LIFECYCLE.BOUNCED,
        isCancelled: true,
        cancelledAt: new Date(),
        isPosted: true,
        postedAt: paper.postedAt ?? new Date(),
        description: note ? [paper.description, note].filter(Boolean).join(' — ') : paper.description,
      };
      if (paperKind === 'PAYMENT') {
        return tx.securitiesPayment.update({
          where: { id: paper.id },
          data: patch,
          include: { customer: true, supplier: true },
        });
      }
      return tx.securitiesReceipt.update({
        where: { id: paper.id },
        data: patch,
        include: { customer: true, supplier: true },
      });
    });
    return this.decoratePaper(ctx.companyId, paperKind, posted);
  }

  async endorsePaper(
    ctx: CommercialPaperPostingCtx,
    paperId: string,
    input: PaperLifecycleInput
  ) {
    const paperKind: CommercialPaperKind = 'RECEIPT';
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    if (paper.isCancelled) throw new AppError(400, 'لا يمكن تظهير ورقة ملغاة');
    if (paper.paperCase !== PAPER_LIFECYCLE.ISSUED) {
      throw new AppError(400, 'لا يمكن تظهير ورقة بعد التحصيل أو الارتداد');
    }
    if (!input.accountId) throw new AppError(400, 'اختر الحساب');

    const account = await prisma.account.findFirst({
      where: { id: input.accountId, companyId: ctx.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!account) throw new AppError(400, 'الحساب المختار غير موجود');

    if (!(await this.isJournalActive(ctx.companyId, paper.journalEntryId))) {
      await this.syncIssueJournal(ctx, paperKind, paperId);
    }

    const amount = money(Number(paper.amount));
    const notesAccountId = await this.notesAccountId(
      ctx.companyId,
      paperKind,
      paper.destinationAccountId
    );
    const depositedAccountId =
      'depositAccountId' in paper ? paper.depositAccountId?.trim() || null : null;
    const creditAccountId = depositedAccountId || notesAccountId;
    const date = asDate(input.date);
    const number = paperNumberOf(paper);
    const note = input.description?.trim();

    const posted = await prisma.$transaction(async (tx) => {
      await this.postPaperJournal(tx, ctx, {
        paperKind,
        paper,
        date,
        description: note || `تظهير ورقة ${number}`,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.ENDORSE,
        lines: buildEndorseLines({
          notesAccountId: creditAccountId,
          partyAccountId: creditAccountId,
          supplierAccountId: input.accountId,
          amount,
          description: note,
        }),
        claimActiveSourceKey: false,
      });
      return tx.securitiesReceipt.update({
        where: { id: paper.id },
        data: {
          paperCase: PAPER_LIFECYCLE.ENDORSED,
          isPosted: true,
          postedAt: new Date(),
        },
        include: { customer: true, supplier: true },
      });
    });
    return this.decoratePaper(ctx.companyId, paperKind, posted);
  }

  async unendorsePaper(ctx: CommercialPaperPostingCtx, paperId: string) {
    const paperKind: CommercialPaperKind = 'RECEIPT';
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    if (paper.paperCase !== PAPER_LIFECYCLE.ENDORSED) {
      throw new AppError(400, 'الورقة ليست مظهرة');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await this.cancelActiveJournalsOfType(tx, ctx, paper.id, [PAPER_JOURNAL_ENTRY_TYPE.ENDORSE]);
      return this.updatePaper(paperKind, paper.id, this.issuedAfterUndoPatch(), tx);
    });
    return this.decoratePaper(ctx.companyId, paperKind, updated);
  }

  async cancelIssuedPaperJournals(
    ctx: CommercialPaperPostingCtx,
    paperKind: CommercialPaperKind,
    paperId: string
  ) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    const hadActiveIssue = await this.isJournalActive(ctx.companyId, paper.journalEntryId);

    await prisma.$transaction(async (tx) => {
      await this.cancelActiveJournalsOfType(tx, ctx, paperId, [
        PAPER_JOURNAL_ENTRY_TYPE.ISSUE,
        PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT,
        paperKind === 'PAYMENT' ? 'SecuritiesPayment' : 'SecuritiesReceipt',
      ]);

      // Reverse the party-card balance that was applied on issue.
      // cascadeSourceJournalInTx inverts account_period_balances but not the
      // cached Customer.balance / Supplier.balance; we must do that here.
      if (hadActiveIssue) {
        const { exchangeRate } = await resolveCompanyFxRate(ctx.companyId, paper.currencyCode);
        const baseAmount = toBaseAmount(money(Number(paper.amount)), exchangeRate);
        await this.applyPartyBalances(tx, paperKind, paper, baseAmount, true);
      }
    });
  }

  async restorePaper(ctx: CommercialPaperPostingCtx, paperKind: CommercialPaperKind, paperId: string) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    if (!paper.isCancelled && paper.paperCase !== PAPER_LIFECYCLE.BOUNCED) {
      throw new AppError(400, 'الورقة ليست مرتدة');
    }

    const amount = money(Number(paper.amount));
    const { exchangeRate } = await resolveCompanyFxRate(ctx.companyId, paper.currencyCode);
    const baseAmount = toBaseAmount(amount, exchangeRate);

    const updated = await prisma.$transaction(async (tx) => {
      const bounceJournals = await tx.journalEntry.findMany({
        where: {
          companyId: ctx.companyId,
          sourceId: paper.id,
          deletedAt: null,
          entryType: PAPER_JOURNAL_ENTRY_TYPE.BOUNCE,
        },
        select: { id: true, reversalOfJournalEntryId: true, isCancelled: true },
      });
      const hadBounceJournal = bounceJournals.some(
        (je) => !je.reversalOfJournalEntryId && !je.isCancelled
      );
      await this.cancelActiveJournalsOfType(tx, ctx, paper.id, [PAPER_JOURNAL_ENTRY_TYPE.BOUNCE]);
      if (hadBounceJournal) {
        await this.applyPartyBalances(tx, paperKind, paper, baseAmount, false);
      }
      return this.updatePaper(paperKind, paper.id, this.issuedAfterUndoPatch(), tx);
    });
    return this.decoratePaper(ctx.companyId, paperKind, updated);
  }

  async executeMultiCollection(
    ctx: CommercialPaperPostingCtx,
    paperKind: CommercialPaperKind,
    paperId: string,
    input: ExecuteMultiCollectionDto
  ) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    ctx = await this.withResolvedBranch(ctx, paper.branchId);

    if (paper.isCancelled) {
      throw new AppError(400, 'لا يمكن تحصيل ورقة ملغاة');
    }
    if (
      paper.paperCase !== PAPER_LIFECYCLE.ISSUED &&
      paper.paperCase !== PAPER_LIFECYCLE.MULTI_COLLECTED
    ) {
      throw new AppError(400, 'لا يمكن التحصيل المتعدد بعد إغلاق الورقة');
    }

    const collectionDate = asDate(input.collectionDate);
    const amount = money(Number(input.amount));
    if (!(amount > 0)) {
      throw new AppError(400, 'أدخل القيمة');
    }

    const existing = await prisma.multiCollectionLine.findMany({
      where: { companyId: ctx.companyId, paperKind, paperId: paper.id },
      select: { amount: true },
    });
    const collected = money(existing.reduce((sum, row) => sum + Number(row.amount), 0));
    const remaining = money(Number(paper.amount) - collected);
    if (amount - remaining > 0.009) {
      throw new AppError(400, 'القيمة تتجاوز الرصيد المتبقي على الورقة');
    }

    const debitAccountId = input.accountId;
    const depositAccountId =
      paperKind === 'RECEIPT' && 'depositAccountId' in paper
        ? paper.depositAccountId?.trim() || null
        : null;
    const creditAccountId =
      depositAccountId ||
      paper.destinationAccountId ||
      (await this.notesAccountId(ctx.companyId, paperKind, paper.destinationAccountId));

    const found = await prisma.account.findMany({
      where: {
        companyId: ctx.companyId,
        id: { in: [debitAccountId, creditAccountId] },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (found.length !== 2 && debitAccountId !== creditAccountId) {
      throw new AppError(400, 'أحد الحسابات المحددة غير موجود أو لا يتبع الشركة');
    }
    if (debitAccountId === creditAccountId) {
      throw new AppError(400, 'حساب التحصيل لا يمكن أن يكون نفس حساب الورقة');
    }

    if (!(await this.isJournalActive(ctx.companyId, paper.journalEntryId))) {
      await this.syncIssueJournal(ctx, paperKind, paperId);
    }

    const hijriDate = input.hijriDate?.trim() || toHijriDate(collectionDate);
    const paperNumber = paperNumberOf(paper);
    const note = input.notes?.trim() || `تحصيل جزئي — ورقة ${paperNumber}`;

    const posted = await prisma.$transaction(async (tx) => {
      await this.postPaperJournal(tx, ctx, {
        paperKind,
        paper,
        date: collectionDate,
        description: note,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.MULTI,
        lines: [
          {
            accountId: debitAccountId,
            debit: amount,
            credit: 0,
            lineOrder: 1,
            description: note,
          },
          {
            accountId: creditAccountId,
            debit: 0,
            credit: amount,
            lineOrder: 2,
            description: note,
          },
        ],
        claimActiveSourceKey: false,
      });

      await tx.multiCollectionLine.create({
        data: {
          companyId: ctx.companyId,
          paperKind,
          paperId: paper.id,
          accountId: debitAccountId,
          amount: new Decimal(amount),
          description: note,
          collectionDate,
          hijriDate,
        },
      });

      const headerPatch = {
        paperCase: PAPER_LIFECYCLE.MULTI_COLLECTED,
        isPosted: true,
        postedAt: new Date(),
      };

      if (paperKind === 'PAYMENT') {
        return tx.securitiesPayment.update({
          where: { id: paper.id },
          data: headerPatch,
          include: { customer: true, supplier: true },
        });
      }
      return tx.securitiesReceipt.update({
        where: { id: paper.id },
        data: headerPatch,
        include: { customer: true, supplier: true },
      });
    });

    const decorated = await this.decoratePaper(ctx.companyId, paperKind, posted);
    return {
      ...decorated,
      multiCollection: {
        amount,
        remaining: money(remaining - amount),
        journalEntryId:
          decorated.journals.find((row) => row.entryType === PAPER_JOURNAL_ENTRY_TYPE.MULTI)?.id ?? null,
      },
    };
  }

  async listLines(companyId: string, paperKind: CommercialPaperKind, paperId: string) {
    return prisma.multiCollectionLine.findMany({
      where: { companyId, paperKind, paperId },
      include: { account: { select: { id: true, code: true, arabicName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const commercialPaperPostingService = new CommercialPaperPostingService();
