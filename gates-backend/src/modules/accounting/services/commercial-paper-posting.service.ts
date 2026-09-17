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
  buildCollectedBounceLines,
  buildEndorseLines,
  buildEndorsedBounceLines,
  buildIssuedBounceLines,
  buildPaymentCollectLines,
  buildPaymentIssueLines,
  buildReceiptCollectLines,
  buildReceiptIssueLines,
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
        where: { id: supplierId, companyId, deletedAt: null },
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
        return {
          id: row.id,
          entryType: row.entryType,
          label: paperJournalLabel(row.entryType, serial),
          voucherNumber: serial,
          date: row.date,
          description: row.description,
          isPosted: row.isPosted,
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
        await this.reverseActiveJournalsOfType(
          tx,
          ctx,
          paper.id,
          isMulti
            ? [PAPER_JOURNAL_ENTRY_TYPE.MULTI, 'MULTI_COLLECTION']
            : [PAPER_JOURNAL_ENTRY_TYPE.COLLECT, PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT],
          isMulti ? 'فك التحصيل المتعدد' : 'فك التحصيل'
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
    input: PaperLifecycleInput,
    opts?: { asBankDeposit?: boolean }
  ) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    if (paper.isCancelled) throw new AppError(400, 'لا يمكن تحصيل ورقة ملغاة');
    if (paper.paperCase !== PAPER_LIFECYCLE.ISSUED) {
      throw new AppError(400, 'الورقة محصّلة أو مغلقة مسبقاً');
    }
    if (!input.accountId) throw new AppError(400, 'اختر حساب التحصيل');

    const account = await prisma.account.findFirst({
      where: { id: input.accountId, companyId: ctx.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!account) throw new AppError(400, 'حساب التحصيل غير موجود');

    if (!(await this.isJournalActive(ctx.companyId, paper.journalEntryId))) {
      await this.syncIssueJournal(ctx, paperKind, paperId);
    }

    const amount = money(Number(paper.amount));
    const notesAccountId = await this.notesAccountId(
      ctx.companyId,
      paperKind,
      paper.destinationAccountId
    );
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
            notesAccountId,
            partyAccountId,
            bankAccountId: input.accountId,
            amount,
            costCenterId: input.costCenterId,
            description: input.description,
          });
    const number = paperNumberOf(paper);
    const asDeposit = Boolean(opts?.asBankDeposit) && paperKind === 'RECEIPT';
    const entryType = asDeposit ? PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT : PAPER_JOURNAL_ENTRY_TYPE.COLLECT;

    const posted = await prisma.$transaction(async (tx) => {
      await this.postPaperJournal(tx, ctx, {
        paperKind,
        paper,
        date,
        description:
          input.description ||
          (asDeposit ? `إيداع ورقة ${number} في البنك` : `تحصيل ورقة ${number}`),
        entryType,
        lines,
        claimActiveSourceKey: false,
      });
      const patch = {
        paperCase: PAPER_LIFECYCLE.COLLECTED,
        isPosted: true,
        postedAt: new Date(),
        description: input.description?.trim()
          ? [paper.description, input.description.trim()].filter(Boolean).join(' — ')
          : paper.description,
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
          depositAccountId: input.accountId,
          depositDate: date,
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
    const issued = await this.syncIssueJournal(ctx, 'RECEIPT', paperId);
    const depositAccountId = deposit?.accountId?.trim();
    if (!depositAccountId) return issued;
    const paper = await this.loadPaper(ctx.companyId, 'RECEIPT', paperId);
    if (paper.paperCase !== PAPER_LIFECYCLE.ISSUED) {
      return this.decoratePaper(ctx.companyId, 'RECEIPT', paper);
    }
    return this.collectPaper(
      ctx,
      'RECEIPT',
      paperId,
      {
        accountId: depositAccountId,
        date: deposit?.date ?? undefined,
        description: 'إيداع في البنك',
      },
      { asBankDeposit: true }
    );
  }

  async bouncePaper(
    ctx: CommercialPaperPostingCtx,
    paperKind: CommercialPaperKind,
    paperId: string,
    input: PaperLifecycleInput
  ) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    assertPaperIssued(paper, 'الارتداد');

    const amount = money(Number(paper.amount));
    const { exchangeRate } = await resolveCompanyFxRate(ctx.companyId, paper.currencyCode);
    const baseAmount = toBaseAmount(amount, exchangeRate);
    const notesAccountId = await this.notesAccountId(
      ctx.companyId,
      paperKind,
      paper.destinationAccountId
    );
    const partyAccountId = await this.partyAccountId(ctx.companyId, paperKind, paper);
    const date = asDate(input.date);
    const number = paperNumberOf(paper);
    const status = paper.paperCase || PAPER_LIFECYCLE.ISSUED;

    let lines: JournalEntryLineData[];
    if (status === PAPER_LIFECYCLE.ENDORSED && paperKind === 'RECEIPT' && paper.supplierId) {
      const supplierAccountId = await this.partyAccountId(
        ctx.companyId,
        paperKind,
        paper,
        paper.supplierId
      );
      lines = buildEndorsedBounceLines({
        notesAccountId,
        partyAccountId,
        supplierAccountId,
        amount,
        description: input.description,
      });
    } else if (status === PAPER_LIFECYCLE.COLLECTED || status === PAPER_LIFECYCLE.MULTI_COLLECTED) {
      const bankAccountId =
        input.accountId ||
        ('depositAccountId' in paper ? paper.depositAccountId : null) ||
        paper.destinationAccountId ||
        undefined;
      lines = buildCollectedBounceLines(paperKind, {
        notesAccountId,
        partyAccountId,
        bankAccountId,
        amount,
        description: input.description,
      });
    } else {
      lines = buildIssuedBounceLines(paperKind, {
        notesAccountId,
        partyAccountId,
        amount,
        description: input.description,
      });
    }

    const posted = await prisma.$transaction(async (tx) => {
      await this.postPaperJournal(tx, ctx, {
        paperKind,
        paper,
        date,
        description: input.description || `ارتداد ورقة ${number}`,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.BOUNCE,
        lines,
        claimActiveSourceKey: false,
      });
      await this.applyPartyBalances(tx, paperKind, paper, baseAmount, true);
      if (status === PAPER_LIFECYCLE.ENDORSED && paper.supplierId) {
        await tx.supplier.update({
          where: { id: paper.supplierId },
          data: { balance: { increment: new Decimal(baseAmount) } },
        });
      }
      const patch = {
        paperCase: PAPER_LIFECYCLE.BOUNCED,
        isCancelled: true,
        cancelledAt: new Date(),
        isPosted: true,
        postedAt: paper.postedAt ?? new Date(),
        description: input.description?.trim()
          ? [paper.description, input.description.trim()].filter(Boolean).join(' — ')
          : paper.description,
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
    if (!input.supplierId) throw new AppError(400, 'اختر المظهَّر إليه');

    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, companyId: ctx.companyId },
      select: { id: true, arabicName: true },
    });
    if (!supplier) throw new AppError(400, 'المورد غير موجود');

    if (!(await this.isJournalActive(ctx.companyId, paper.journalEntryId))) {
      await this.syncIssueJournal(ctx, paperKind, paperId);
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
    const supplierAccountId = await this.partyAccountId(ctx.companyId, paperKind, paper, supplier.id);
    const date = asDate(input.date);
    const number = paperNumberOf(paper);
    const note = input.description?.trim();

    const posted = await prisma.$transaction(async (tx) => {
      await this.postPaperJournal(tx, ctx, {
        paperKind,
        paper,
        date,
        description: note || `تظهير ورقة ${number} إلى ${supplier.arabicName}`,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.ENDORSE,
        lines: buildEndorseLines({
          notesAccountId,
          partyAccountId,
          supplierAccountId,
          amount,
          description: note,
        }),
        claimActiveSourceKey: false,
      });
      await tx.supplier.update({
        where: { id: supplier.id },
        data: { balance: { decrement: new Decimal(baseAmount) } },
      });
      return tx.securitiesReceipt.update({
        where: { id: paper.id },
        data: {
          supplierId: supplier.id,
          issuerName: supplier.arabicName ?? paper.issuerName,
          paperCase: PAPER_LIFECYCLE.ENDORSED,
          isPosted: true,
          postedAt: new Date(),
          description: note
            ? [paper.description, `تظهير إلى ${supplier.arabicName}: ${note}`].filter(Boolean).join(' — ')
            : paper.description,
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

    const amount = money(Number(paper.amount));
    const { exchangeRate } = await resolveCompanyFxRate(ctx.companyId, paper.currencyCode);
    const baseAmount = toBaseAmount(amount, exchangeRate);

    const updated = await prisma.$transaction(async (tx) => {
      await this.reverseActiveJournalsOfType(
        tx,
        ctx,
        paper.id,
        [PAPER_JOURNAL_ENTRY_TYPE.ENDORSE],
        'فك التظهير'
      );
      if (paper.supplierId) {
        await tx.supplier.update({
          where: { id: paper.supplierId },
          data: { balance: { increment: new Decimal(baseAmount) } },
        });
      }
      return this.updatePaper(
        paperKind,
        paper.id,
        {
          ...this.issuedAfterUndoPatch(),
          supplierId: paper.customerId ? null : paper.supplierId,
        },
        tx
      );
    });
    return this.decoratePaper(ctx.companyId, paperKind, updated);
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
      await this.reverseActiveJournalsOfType(
        tx,
        ctx,
        paper.id,
        [PAPER_JOURNAL_ENTRY_TYPE.BOUNCE],
        'فك الارتداد'
      );
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
    if (paper.paperCase !== PAPER_LIFECYCLE.ISSUED) {
      throw new AppError(400, 'الورقة محصّلة مسبقاً');
    }

    const collectionDate = asDate(input.collectionDate);
    const lines = (input.lines ?? []).filter((line) => line.accountId && Number(line.amount) > 0);
    if (lines.length === 0) {
      throw new AppError(400, 'أضف سطر تحصيل واحداً على الأقل');
    }

    const gross = money(lines.reduce((sum, line) => sum + Number(line.amount), 0));
    const commission = money(Number(input.commissionAmount) || 0);
    const paperAmount = money(Number(paper.amount));
    if (gross - paperAmount > 0.009) {
      throw new AppError(400, 'إجمالي سطور التحصيل يتجاوز مبلغ الورقة');
    }
    if (commission > 0 && !input.commissionAccountId) {
      throw new AppError(400, 'اختر حساب العمولة عند إدخال قيمة عمولة');
    }
    if (paperKind === 'RECEIPT' && commission - gross > 0.009) {
      throw new AppError(400, 'العمولة لا يمكن أن تتجاوز إجمالي التحصيل');
    }

    const accountIds = [
      input.destinationAccountId,
      ...lines.map((line) => line.accountId),
      ...(commission > 0 && input.commissionAccountId ? [input.commissionAccountId] : []),
    ];
    const uniqueIds = [...new Set(accountIds)];
    const found = await prisma.account.findMany({
      where: { companyId: ctx.companyId, id: { in: uniqueIds }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== uniqueIds.length) {
      throw new AppError(400, 'أحد الحسابات المحددة غير موجود أو لا يتبع الشركة');
    }

    if (!(await this.isJournalActive(ctx.companyId, paper.journalEntryId))) {
      await this.syncIssueJournal(ctx, paperKind, paperId);
    }

    const net = paperKind === 'RECEIPT' ? money(gross - commission) : money(gross + commission);
    const hijriDate = input.hijriDate?.trim() || toHijriDate(collectionDate);
    const paperNumber = paperNumberOf(paper);
    const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, collectionDate);
    const { exchangeRate } = await resolveCompanyFxRate(ctx.companyId, paper.currencyCode);

    const jeLines: JournalEntryLineData[] = [];
    let order = 1;

    if (paperKind === 'RECEIPT') {
      if (net > 0) {
        jeLines.push({
          accountId: input.destinationAccountId,
          debit: net,
          credit: 0,
          lineOrder: order++,
          description: input.notes || 'صافي المحصل',
        });
      }
      if (commission > 0 && input.commissionAccountId) {
        jeLines.push({
          accountId: input.commissionAccountId,
          debit: commission,
          credit: 0,
          lineOrder: order++,
          description: 'عمولة تحصيل',
        });
      }
      for (const line of lines) {
        jeLines.push({
          accountId: line.accountId,
          debit: 0,
          credit: money(line.amount),
          lineOrder: order++,
          description: line.description || undefined,
        });
      }
    } else {
      for (const line of lines) {
        jeLines.push({
          accountId: line.accountId,
          debit: money(line.amount),
          credit: 0,
          lineOrder: order++,
          description: line.description || undefined,
        });
      }
      if (commission > 0 && input.commissionAccountId) {
        jeLines.push({
          accountId: input.commissionAccountId,
          debit: commission,
          credit: 0,
          lineOrder: order++,
          description: 'عمولة تحصيل',
        });
      }
      jeLines.push({
        accountId: input.destinationAccountId,
        debit: 0,
        credit: net,
        lineOrder: order++,
        description: input.notes || 'صافي المنصرف',
      });
    }

    const posted = await prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(
        tx,
        this.postingCtx(ctx, fiscalYearId),
        {
          fiscalYearId,
          date: collectionDate,
          hijriDate,
          description:
            input.notes ||
            `تحصيل متعدد — ${paperKind === 'PAYMENT' ? 'ورقة مدفوعات' : 'ورقة مقبوضات'} ${paperNumber}`,
          currencyCode: paper.currencyCode,
          exchangeRate,
          entryType: PAPER_JOURNAL_ENTRY_TYPE.MULTI,
          sourceType: sourceTypeOf(paperKind),
          sourceId: paper.id,
          sourceNumber: paperNumber,
          claimActiveSourceKey: false,
          lines: jeLines,
        }
      );

      await tx.multiCollectionLine.createMany({
        data: lines.map((line) => ({
          companyId: ctx.companyId,
          paperKind,
          paperId: paper.id,
          accountId: line.accountId,
          amount: new Decimal(money(line.amount)),
          description: line.description || null,
          collectionDate,
          hijriDate,
        })),
      });

      const headerPatch = {
        paperCase: PAPER_LIFECYCLE.MULTI_COLLECTED,
        isPosted: true,
        postedAt: new Date(),
        destinationAccountId: input.destinationAccountId,
        commissionAmount: new Decimal(commission),
        commissionAccountId: input.commissionAccountId || null,
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
        gross,
        commission,
        net,
        journalEntryId: decorated.journals.find((row) => row.entryType === PAPER_JOURNAL_ENTRY_TYPE.MULTI)?.id ?? null,
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
