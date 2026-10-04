import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { toHijriDate } from '../../../shared/utils/hijri-date';
import type { ExecuteMultiCollectionDto } from '../../treasury/dto/commercial-paper.dto';
import type { JournalEntryLineData } from '../types/journal-entry.types';
import { journalPostingService } from './journal-posting.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import {
  companyOpeningJournalIsPosted,
  OPENING_JOURNAL_UNPOST_FIRST_MESSAGE,
} from './opening-balance.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { customerLedgerAccountService } from './customer-ledger-account.service';
import { resolveCompanyFxRate, toBaseAmount } from '../utils/company-fx-rate';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  PAPER_JOURNAL_ENTRY_TYPE,
  PAPER_LIFECYCLE,
  buildEndorseLines,
  buildPaymentCollectLines,
  buildPaymentIssueLines,
  buildReceiptCollectLines,
  buildReceiptDepositLines,
  buildReceiptIssueLines,
  buildIssuedBounceLines,
  invertJournalLines,
  isLifecycleBeyondIssue,
  paperJournalLabel,
} from '../utils/commercial-paper-journals';
import { assertPaperIssued } from '../utils/securities-paper-case';
import { paperPartyLabel } from '../utils/paper-party-label';
import {
  applyPartnerCardBalancesFromLinesInTx,
  applyPostedJournalBalancesInTx,
  type PostedJournalLineDelta,
} from './ledger-balance.service';

export type CommercialPaperKind = 'PAYMENT' | 'RECEIPT';

/** Shared AR/AP accounts must not move cards by account inference — use line `partnerId`. */
const COMMERCIAL_PAPER_SKIP_ACCOUNT_CARD_COLUMNS = true;

function isOpeningPaper(paper: object): boolean {
  return 'isOpening' in paper && Boolean((paper as { isOpening?: boolean }).isOpening);
}

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
  return roundTo4(Number(value) || 0);
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
    const paperInclude = {
      customer: { select: { id: true, arabicName: true, englishName: true, code: true } },
      supplier: { select: { id: true, arabicName: true, englishName: true, code: true } },
      entity: { select: { id: true, arabicName: true } },
    } as const;
    const paper =
      paperKind === 'PAYMENT'
        ? await prisma.securitiesPayment.findFirst({
            where: { id: paperId, companyId },
            include: paperInclude,
          })
        : await prisma.securitiesReceipt.findFirst({
            where: { id: paperId, companyId },
            include: paperInclude,
          });
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
      partyAccountId?: string | null;
    },
    overrideSupplierId?: string | null
  ) {
    const explicit = paper.partyAccountId?.trim();
    if (explicit) {
      const account = await prisma.account.findFirst({
        where: { id: explicit, companyId, deletedAt: null },
        select: { id: true },
      });
      if (account) return account.id;
    }
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
      paperKind === 'PAYMENT' ? 'اختر المورد أو حساب حركة قبل إنشاء قيد الورقة' : 'اختر العميل أو حساب حركة قبل إنشاء قيد الورقة'
    );
  }

  private async resolveEndorseeSupplier(companyId: string, supplierId?: string | null, accountId?: string | null) {
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, companyId },
        select: { id: true },
      });
      if (!supplier) throw new AppError(400, 'المورد المظهَّر إليه غير موجود');
      return supplier;
    }
    const matches = await prisma.supplier.findMany({
      where: {
        companyId,
        OR: [{ mainAccountId: accountId ?? '' }, { accountId: accountId ?? '' }],
      },
      select: { id: true, mainAccountId: true },
    });
    const preferred = matches.filter((row) => row.mainAccountId === accountId);
    const chosen = preferred.length ? preferred : matches;
    if (chosen.length === 1) return chosen[0]!;
    if (chosen.length > 1) {
      throw new AppError(400, 'أكثر من مورد على هذا الحساب — حدّد المورد');
    }
    return null;
  }

  private async syncCommercialPaperJournalCardCachesInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    journalEntryId: string,
    options?: { invert?: boolean }
  ) {
    const entry = await tx.journalEntry.findFirst({
      where: { id: journalEntryId, companyId, deletedAt: null },
      select: { date: true, currencyCode: true },
    });
    if (!entry) return;
    const lines = await tx.journalEntryLine.findMany({
      where: { journalEntryId },
      orderBy: { lineOrder: 'asc' },
    });
    if (!lines.length) return;

    const deltas: PostedJournalLineDelta[] = lines.map((line) => ({
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
      debitBase: line.debitBase,
      creditBase: line.creditBase,
      partnerId: line.partnerId,
      partnerType: line.partnerType,
    }));
    await applyPartnerCardBalancesFromLinesInTx(tx, companyId, deltas, { invert: options?.invert });

    const treasuryLines = lines.filter((line) => !line.partnerId);
    if (treasuryLines.length > 0) {
      await applyPostedJournalBalancesInTx(tx, {
        companyId,
        date: entry.date,
        currencyCode: entry.currencyCode || 'EGP',
        skipAccountPeriod: true,
        skipPartnerBalances: true,
        invert: options?.invert,
        lines: treasuryLines,
      });
    }
  }

  private async unpostCommercialPaperJournalInTx(
    tx: Prisma.TransactionClient,
    ctx: CommercialPaperPostingCtx,
    fiscalYearId: string,
    journalEntryId: string
  ) {
    const result = await journalPostingService.unpostSourceJournalInTx(
      tx,
      this.postingCtx(ctx, fiscalYearId),
      journalEntryId,
      { skipCardColumns: COMMERCIAL_PAPER_SKIP_ACCOUNT_CARD_COLUMNS }
    );
    if (result) {
      await this.syncCommercialPaperJournalCardCachesInTx(tx, ctx.companyId, journalEntryId, {
        invert: true,
      });
    }
    return result;
  }

  /** A bank GL must not be the debit of an inward-paper deposit. That step only moves the note into «برسم التحصيل». */
  private async resolveReceiptDepositDebit(companyId: string, selectedId: string): Promise<string> {
    const bank = await prisma.bankAccount.findFirst({
      where: { companyId, glAccountId: selectedId, isActive: true },
      select: { id: true },
    });
    if (!bank) return selectedId;
    const accounts = await treasuryAccountResolverService.resolveChequeAccounts(companyId);
    return accounts.chequesUnderCollectionAccountId;
  }

  private async applyBankGlBalance(
    _tx: Prisma.TransactionClient,
    _companyId: string,
    _glAccountId: string,
    _baseAmount: number,
    _direction: 'increment' | 'decrement'
  ) {
    // Collection journals debit or credit the bank GL. The bank card moves
    // with that journal.
    return;
  }

  private async reverseCollectionBankBalances(
    tx: Prisma.TransactionClient,
    ctx: CommercialPaperPostingCtx,
    paper: { id: string; currencyCode: string },
    paperKind: CommercialPaperKind,
    entryTypes: string[]
  ) {
    const journals = await tx.journalEntry.findMany({
      where: {
        companyId: ctx.companyId,
        sourceId: paper.id,
        deletedAt: null,
        isCancelled: false,
        reversalOfJournalEntryId: null,
        entryType: { in: entryTypes },
      },
      include: { lines: true },
    });
    const fallback = (await resolveCompanyFxRate(ctx.companyId, paper.currencyCode)).exchangeRate;
    for (const journal of journals) {
      const reversed = await tx.journalEntry.findFirst({
        where: { companyId: ctx.companyId, reversalOfJournalEntryId: journal.id },
        select: { id: true },
      });
      if (reversed) continue;
      const rate = Number(journal.exchangeRate) || fallback;
      for (const line of journal.lines) {
        const face = paperKind === 'RECEIPT' ? Number(line.debit) : Number(line.credit);
        if (!(face > 0)) continue;
        await this.applyBankGlBalance(
          tx,
          ctx.companyId,
          line.accountId,
          toBaseAmount(face, rate),
          paperKind === 'RECEIPT' ? 'decrement' : 'increment'
        );
      }
    }
  }

  private async isJournalActive(companyId: string, journalEntryId?: string | null): Promise<boolean> {
    if (!journalEntryId) return false;
    const [entry, reversal] = await Promise.all([
      prisma.journalEntry.findFirst({
        where: { id: journalEntryId, companyId, deletedAt: null, isCancelled: false, isPosted: true },
        select: { id: true },
      }),
      prisma.journalEntry.findFirst({
        where: { reversalOfJournalEntryId: journalEntryId, companyId },
        select: { id: true },
      }),
    ]);
    return Boolean(entry && !reversal);
  }

  private issuedAfterUndoPatch(issuedStillPosted: boolean, postedAt?: Date | null) {
    return {
      paperCase: PAPER_LIFECYCLE.ISSUED,
      isPosted: issuedStillPosted,
      postedAt: issuedStillPosted ? postedAt ?? new Date() : null,
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
      select: { id: true, reversalOfJournalEntryId: true, isPosted: true, postingStatus: true },
    });
    const active = journals.filter((row) => !row.reversalOfJournalEntryId);
    const ids = active.map((row) => row.id);
    if (!ids.length) return;
    const postedIds = active
      .filter((row) => row.isPosted || row.postingStatus === 'Post')
      .map((row) => row.id);
    await journalPostingService.cascadeSourceJournalInTx(
      tx,
      ctx.companyId,
      ids,
      'cancel',
      ctx.userId,
      undefined,
      { skipCardColumns: COMMERCIAL_PAPER_SKIP_ACCOUNT_CARD_COLUMNS }
    );
    for (const id of postedIds) {
      await this.syncCommercialPaperJournalCardCachesInTx(tx, ctx.companyId, id, { invert: true });
    }
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
    const created = await journalPostingService.createAndPostInTx(tx, this.postingCtx(ctx, fiscalYearId), {
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
      skipCardColumns: COMMERCIAL_PAPER_SKIP_ACCOUNT_CARD_COLUMNS,
      lines: params.lines,
    });
    await this.syncCommercialPaperJournalCardCachesInTx(tx, ctx.companyId, created.id);
    return created;
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
    const reversedOf = new Set(
      rows
        .map((row) => row.reversalOfJournalEntryId)
        .filter((id): id is string => Boolean(id))
    );
    const seen = new Set<string>();
    return rows
      .filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        if (row.isCancelled) return false;
        if (row.reversalOfJournalEntryId) return false;
        if (row.entryType === 'REVERSAL') return false;
        if (reversedOf.has(row.id)) return false;
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
    const named = paper as T & {
      payeeName?: string | null;
      issuerName?: string | null;
      partyAccountId?: string | null;
      supplier?: { arabicName?: string | null } | null;
      customer?: { arabicName?: string | null } | null;
    };
    const hasName = paperPartyLabel(named);
    const partyAccount =
      !hasName && named.partyAccountId
        ? await prisma.account.findFirst({
            where: { id: named.partyAccountId, companyId, deletedAt: null },
            select: { id: true, code: true, arabicName: true },
          })
        : null;
    return {
      ...paper,
      journals,
      multiCollectionLines,
      journalEntryId: paper.journalEntryId || journals.find((row) => !row.isReversal)?.id || null,
      partyDisplayName: paperPartyLabel({ ...named, partyAccount }),
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
    // An explicit unpost leaves the issue journal in place with isPosted false.
    // Rebuilding it here would post the paper again, so the next ترحيل is rejected.
    if (!paper.isPosted && paper.journalEntryId) {
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
    if (isOpeningPaper(paper)) {
      return this.decoratePaper(ctx.companyId, paperKind, paper);
    }
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
    if (!paper.customerId && !paper.supplierId && !paper.partyAccountId) {
      throw new AppError(
        422,
        paperKind === 'PAYMENT'
          ? 'اختر المورد أو حساب حركة قبل إنشاء قيد التحرير'
          : 'اختر العميل أو حساب حركة قبل إنشاء قيد التحرير'
      );
    }

    const amount = money(Number(paper.amount));
    const { exchangeRate } = await resolveCompanyFxRate(ctx.companyId, paper.currencyCode);
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
    const partnerId = paper.customerId || paper.supplierId || undefined;
    const partnerType = paper.customerId ? 'CUSTOMER' : paper.supplierId ? 'SUPPLIER' : undefined;
    if (partnerId && partnerType) {
      for (const line of lines) {
        const partySide = paperKind === 'RECEIPT' ? line.credit > 0 : line.debit > 0;
        if (partySide && line.accountId === partyAccountId) {
          line.partnerId = partnerId;
          line.partnerType = partnerType;
        }
      }
    }
    const number = paperNumberOf(paper);
    const title = paperKind === 'PAYMENT' ? 'ورقة مدفوعات' : 'ورقة مقبوضات';
    const description = paper.description || `تحرير ${title} ${number}`;
    const existingIssue = paper.journalEntryId
      ? await prisma.journalEntry.findFirst({
          where: { id: paper.journalEntryId, companyId: ctx.companyId, deletedAt: null },
          include: { lines: { select: { debit: true } } },
        })
      : null;
    const issueReversed = existingIssue
      ? await prisma.journalEntry.findFirst({
          where: { companyId: ctx.companyId, reversalOfJournalEntryId: existingIssue.id },
          select: { id: true },
        })
      : null;
    const reusableIssue = existingIssue && !existingIssue.isCancelled && !issueReversed ? existingIssue : null;

    if (reusableIssue) {
      const wasPosted = Boolean(reusableIssue.isPosted || reusableIssue.postingStatus === 'Post');
      const posted = await prisma.$transaction(async (tx) => {
        const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, paper.date);
        if (wasPosted) {
          await this.syncCommercialPaperJournalCardCachesInTx(tx, ctx.companyId, reusableIssue.id, {
            invert: true,
          });
        }
        await journalPostingService.replacePostedJournalInTx(
          tx,
          this.postingCtx(ctx, fiscalYearId),
          reusableIssue.id,
          {
            date: paper.date,
            description,
            currencyCode: paper.currencyCode,
            exchangeRate,
            sourceNumber: number,
            lines,
          },
          { skipCardColumns: COMMERCIAL_PAPER_SKIP_ACCOUNT_CARD_COLUMNS }
        );
        if (wasPosted) {
          await this.syncCommercialPaperJournalCardCachesInTx(tx, ctx.companyId, reusableIssue.id);
        }
        const patch = {
          journalEntryId: reusableIssue.id,
          paperCase: PAPER_LIFECYCLE.ISSUED,
          destinationAccountId: notesAccountId,
          isPosted: wasPosted,
          postedAt: wasPosted ? paper.postedAt ?? new Date() : null,
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

    const posted = await prisma.$transaction(async (tx) => {
      const je = await this.postPaperJournal(tx, ctx, {
        paperKind,
        paper,
        date: paper.date,
        description,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.ISSUE,
        lines,
        claimActiveSourceKey: true,
      });

      const patch = {
        journalEntryId: je.id,
        paperCase: PAPER_LIFECYCLE.ISSUED,
        destinationAccountId: notesAccountId,
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
        data: patch,
        include: { customer: true, supplier: true },
      });
    });

    return this.decoratePaper(ctx.companyId, paperKind, posted);
  }

  async postPaper(ctx: CommercialPaperPostingCtx, paperKind: CommercialPaperKind, paperId: string) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    if (isOpeningPaper(paper)) {
      throw new AppError(
        400,
        'الأوراق المالية السابقة لا تُرحَّل كتحرير. حمّل قيمتها من قيد الرصيد الافتتاحي، والتحصيل يتم من شاشة الورقة.'
      );
    }
    if (paper.isCancelled) throw new AppError(400, 'لا يمكن ترحيل ورقة ملغاة');
    if (paper.isPosted) throw new AppError(400, 'الورقة مرحّلة مسبقاً');
    if (isLifecycleBeyondIssue(paper.paperCase)) {
      throw new AppError(400, 'لا يمكن ترحيل الورقة بعد التحصيل أو الارتداد أو التظهير');
    }

    const issue = paper.journalEntryId
      ? await prisma.journalEntry.findFirst({
          where: { id: paper.journalEntryId, companyId: ctx.companyId, deletedAt: null },
          select: { id: true, isPosted: true, isCancelled: true, postingStatus: true },
        })
      : null;
    if (issue && !issue.isCancelled && !(issue.isPosted || issue.postingStatus === 'Post')) {
      const ready = await this.withResolvedBranch(ctx, paper.branchId);
      const reposted = await prisma.$transaction(async (tx) => {
        const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, paper.date);
        await journalPostingService.repostSourceJournalInTx(
          tx,
          this.postingCtx(ready, fiscalYearId),
          issue.id,
          journalPostingService.buildActiveSourceKey(
            ctx.companyId,
            sourceTypeOf(paperKind),
            paperNumberOf(paper),
            ''
          ),
          { skipCardColumns: COMMERCIAL_PAPER_SKIP_ACCOUNT_CARD_COLUMNS }
        );
        await this.syncCommercialPaperJournalCardCachesInTx(tx, ctx.companyId, issue.id);
        const patch = { isPosted: true, postedAt: new Date(), journalEntryId: issue.id };
        if (paperKind === 'PAYMENT') {
          return tx.securitiesPayment.update({
            where: { id: paperId },
            data: patch,
            include: { customer: true, supplier: true },
          });
        }
        return tx.securitiesReceipt.update({
          where: { id: paperId },
          data: patch,
          include: { customer: true, supplier: true },
        });
      });
      return this.afterIssuePosted(ctx, paperKind, paperId, paper, reposted);
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
    return this.afterIssuePosted(ctx, paperKind, paperId, paper, posted);
  }

  private async afterIssuePosted<T extends { id: string; journalEntryId?: string | null }>(
    ctx: CommercialPaperPostingCtx,
    paperKind: CommercialPaperKind,
    paperId: string,
    paper: T,
    posted: T
  ) {
    if (
      paperKind === 'RECEIPT' &&
      'depositAccountId' in paper &&
      typeof paper.depositAccountId === 'string' &&
      paper.depositAccountId
    ) {
      const depositDate =
        'depositDate' in paper && paper.depositDate instanceof Date ? paper.depositDate : null;
      return this.syncDepositJournal(ctx, paperId, {
        accountId: paper.depositAccountId,
        date: depositDate,
      });
    }
    return this.decoratePaper(ctx.companyId, paperKind, posted);
  }

  async uncollectPaper(ctx: CommercialPaperPostingCtx, paperKind: CommercialPaperKind, paperId: string) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    const paperCase = paper.paperCase || PAPER_LIFECYCLE.ISSUED;
    if (paperCase !== PAPER_LIFECYCLE.COLLECTED && paperCase !== PAPER_LIFECYCLE.MULTI_COLLECTED) {
      throw new AppError(400, 'الورقة ليست محصّلة');
    }
    const isMulti = paperCase === PAPER_LIFECYCLE.MULTI_COLLECTED;
    const collectTypes = isMulti
      ? [PAPER_JOURNAL_ENTRY_TYPE.MULTI, 'MULTI_COLLECTION']
      : [PAPER_JOURNAL_ENTRY_TYPE.COLLECT];
    const issuedStillPosted = await this.isJournalActive(ctx.companyId, paper.journalEntryId);
    const updated = await prisma.$transaction(async (tx) => {
      await this.reverseCollectionBankBalances(tx, ctx, paper, paperKind, collectTypes);
      await this.cancelActiveJournalsOfType(tx, ctx, paper.id, collectTypes);
      await tx.multiCollectionLine.deleteMany({
        where: { companyId: ctx.companyId, paperKind, paperId: paper.id },
      });
      return this.updatePaper(
        paperKind,
        paper.id,
        this.issuedAfterUndoPatch(issuedStillPosted, paper.postedAt),
        tx
      );
    });
    return this.decoratePaper(ctx.companyId, paperKind, updated);
  }

  async unpostPaper(ctx: CommercialPaperPostingCtx, paperKind: CommercialPaperKind, paperId: string) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    if (isOpeningPaper(paper)) {
      throw new AppError(400, 'الأوراق المالية السابقة تُحفظ مرحّلة. فك الترحيل يتم من قيد الرصيد الافتتاحي.');
    }

    if (!paper.isPosted && !(await this.isJournalActive(ctx.companyId, paper.journalEntryId))) {
      throw new AppError(400, 'الورقة غير مرحّلة');
    }

    const ready = await this.withResolvedBranch(ctx, paper.branchId);

    const updated = await prisma.$transaction(async (tx) => {
      const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, paper.date);
      if (paper.journalEntryId) {
        await this.unpostCommercialPaperJournalInTx(tx, ready, fiscalYearId, paper.journalEntryId);
      }
      const deposits = await tx.journalEntry.findMany({
        where: {
          companyId: ctx.companyId,
          sourceId: paper.id,
          entryType: PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT,
          deletedAt: null,
          isCancelled: false,
          reversalOfJournalEntryId: null,
        },
        select: { id: true },
      });
      for (const deposit of deposits) {
        await this.unpostCommercialPaperJournalInTx(tx, ready, fiscalYearId, deposit.id);
      }
      return this.updatePaper(
        paperKind,
        paperId,
        { isPosted: false, postedAt: null },
        tx
      );
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
      throw new AppError(400, 'الورقة محصّلة بالفعل ولا يمكن تحصيلها مرة أخرى');
    }
    const existingCollect = await prisma.journalEntry.findFirst({
      where: {
        companyId: ctx.companyId,
        sourceId: paper.id,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.COLLECT,
        deletedAt: null,
        isCancelled: false,
        reversalOfJournalEntryId: null,
      },
      select: { id: true },
    });
    if (existingCollect && (await this.isJournalActive(ctx.companyId, existingCollect.id))) {
      throw new AppError(400, 'الورقة محصّلة بالفعل ولا يمكن تحصيلها مرة أخرى');
    }
    if (!input.accountId) {
      throw new AppError(400, 'اختر حساب التحصيل');
    }
    const bankGlId = input.accountId;

    const account = await prisma.account.findFirst({
      where: { id: bankGlId, companyId: ctx.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!account) throw new AppError(400, 'حساب التحصيل غير موجود');

    let issueId = paper.journalEntryId;
    if (!issueId) {
      const synced = await this.syncIssueJournal(ctx, paperKind, paperId);
      issueId = synced.journalEntryId ?? null;
    }
    const issueJournal = issueId
      ? await prisma.journalEntry.findFirst({
          where: { id: issueId, companyId: ctx.companyId, deletedAt: null },
          select: { id: true, isPosted: true, isCancelled: true, postingStatus: true },
        })
      : null;
    const issueNeedsRepost = Boolean(
      issueJournal && !issueJournal.isCancelled && !(issueJournal.isPosted || issueJournal.postingStatus === 'Post')
    );

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
            bankAccountId: bankGlId,
            amount,
            costCenterId: input.costCenterId,
            description: input.description,
          })
        : buildReceiptCollectLines({
            notesAccountId: creditAccountId,
            partyAccountId,
            bankAccountId: bankGlId,
            amount,
            costCenterId: input.costCenterId,
            description: input.description,
          });
    const number = paperNumberOf(paper);
    if (paperKind === 'RECEIPT' && depositedAccountId) {
      await this.syncDepositJournal(
        ctx,
        paperId,
        {
          accountId: depositedAccountId,
          date: 'depositDate' in paper ? paper.depositDate ?? null : null,
        },
        { postEvenIfUnposted: true }
      );
    }

    const posted = await prisma.$transaction(async (tx) => {
      const claimWhere = { id: paper.id, companyId: ctx.companyId, paperCase: PAPER_LIFECYCLE.ISSUED };
      const claimData = { paperCase: PAPER_LIFECYCLE.COLLECTED, isPosted: true, postedAt: new Date() };
      const claim =
        paperKind === 'PAYMENT'
          ? await tx.securitiesPayment.updateMany({ where: claimWhere, data: claimData })
          : await tx.securitiesReceipt.updateMany({ where: claimWhere, data: claimData });
      if (claim.count !== 1) {
        throw new AppError(400, 'الورقة محصّلة بالفعل ولا يمكن تحصيلها مرة أخرى');
      }
      if (issueNeedsRepost && issueId) {
        const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, paper.date);
        const ready = await this.withResolvedBranch(ctx, paper.branchId);
        await journalPostingService.repostSourceJournalInTx(
          tx,
          this.postingCtx(ready, fiscalYearId),
          issueId,
          journalPostingService.buildActiveSourceKey(
            ctx.companyId,
            sourceTypeOf(paperKind),
            number,
            ''
          ),
          { skipCardColumns: COMMERCIAL_PAPER_SKIP_ACCOUNT_CARD_COLUMNS }
        );
        await this.syncCommercialPaperJournalCardCachesInTx(tx, ctx.companyId, issueId);
      }
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

  async syncDepositJournal(
    ctx: CommercialPaperPostingCtx,
    paperId: string,
    deposit?: { accountId?: string | null; date?: Date | null },
    options?: { postEvenIfUnposted?: boolean }
  ) {
    const depositAccountId = deposit?.accountId?.trim();
    if (!depositAccountId) {
      const paper = await this.loadPaper(ctx.companyId, 'RECEIPT', paperId);
      if (paper.paperCase !== PAPER_LIFECYCLE.ISSUED) {
        return this.decoratePaper(ctx.companyId, 'RECEIPT', paper);
      }
      const updated = await prisma.$transaction(async (tx) => {
        const ready = await this.withResolvedBranch(ctx, paper.branchId);
        const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, paper.date);
        const deposits = await tx.journalEntry.findMany({
          where: {
            companyId: ctx.companyId,
            sourceId: paper.id,
            entryType: PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT,
            deletedAt: null,
            isCancelled: false,
            reversalOfJournalEntryId: null,
          },
          select: { id: true },
        });
        for (const deposit of deposits) {
          await this.unpostCommercialPaperJournalInTx(tx, ready, fiscalYearId, deposit.id);
        }
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
    const debitAccountId = await this.resolveReceiptDepositDebit(ctx.companyId, depositAccountId);
    if (debitAccountId === notesAccountId) {
      throw new AppError(400, 'حساب الإيداع لا يمكن أن يكون نفس حساب أوراق القبض. استخدم «أوراق قبض برسم التحصيل»، والبنك يُختار عند التحصيل.');
    }
    const date = asDate(deposit?.date ?? paper.date);
    const number = paperNumberOf(paper);
    const description = `إيداع ورقة ${number} برسم التحصيل`;
    const lines = buildReceiptDepositLines({
      notesAccountId,
      partyAccountId: notesAccountId,
      bankAccountId: debitAccountId,
      amount,
      description,
    });

    const postDeposit = Boolean(paper.isPosted || options?.postEvenIfUnposted);
    const posted = await prisma.$transaction(async (tx) => {
      const activeDeposit = await tx.journalEntry.findFirst({
        where: {
          companyId: ctx.companyId,
          sourceId: paper.id,
          entryType: PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT,
          deletedAt: null,
          isCancelled: false,
          reversalOfJournalEntryId: null,
        },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
      if (activeDeposit) {
        const reversed = await tx.journalEntry.findFirst({
          where: { companyId: ctx.companyId, reversalOfJournalEntryId: activeDeposit.id },
          select: { id: true },
        });
        const debitLine = activeDeposit.lines.find((line) => Number(line.debit) > 0);
        const currentDebit = debitLine?.accountId;
        const sameAmount = Math.abs(Number(debitLine?.debit || 0) - amount) < 0.0001;
        if (!reversed) {
          const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, date);
          const ready = await this.withResolvedBranch(ctx, paper.branchId);
          const depositPosted = Boolean(activeDeposit.isPosted || activeDeposit.postingStatus === 'Post');
          if (!(currentDebit === debitAccountId && sameAmount)) {
            if (depositPosted) {
              await this.syncCommercialPaperJournalCardCachesInTx(tx, ctx.companyId, activeDeposit.id, {
                invert: true,
              });
            }
            await journalPostingService.replacePostedJournalInTx(
              tx,
              this.postingCtx(ready, fiscalYearId),
              activeDeposit.id,
              {
                date,
                description,
                currencyCode: paper.currencyCode,
                sourceNumber: number,
                lines,
              },
              { skipCardColumns: COMMERCIAL_PAPER_SKIP_ACCOUNT_CARD_COLUMNS }
            );
            if (depositPosted) {
              await this.syncCommercialPaperJournalCardCachesInTx(tx, ctx.companyId, activeDeposit.id);
            }
          }
          if (!depositPosted && postDeposit) {
            await journalPostingService.repostSourceJournalInTx(
              tx,
              this.postingCtx(ready, fiscalYearId),
              activeDeposit.id,
              undefined,
              { skipCardColumns: COMMERCIAL_PAPER_SKIP_ACCOUNT_CARD_COLUMNS }
            );
            await this.syncCommercialPaperJournalCardCachesInTx(tx, ctx.companyId, activeDeposit.id);
          }
          return tx.securitiesReceipt.update({
            where: { id: paper.id },
            data: {
              destinationAccountId: paper.destinationAccountId || notesAccountId,
              depositAccountId: debitAccountId,
              depositDate: date,
              paperCase: PAPER_LIFECYCLE.ISSUED,
            },
            include: { customer: true, supplier: true },
          });
        }
      }
      if (!postDeposit) {
        return tx.securitiesReceipt.update({
          where: { id: paper.id },
          data: {
            destinationAccountId: paper.destinationAccountId || notesAccountId,
            depositAccountId: debitAccountId,
            depositDate: date,
            paperCase: PAPER_LIFECYCLE.ISSUED,
          },
          include: { customer: true, supplier: true },
        });
      }
      await this.postPaperJournal(tx, ctx, {
        paperKind: 'RECEIPT',
        paper,
        date,
        description,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT,
        lines,
        claimActiveSourceKey: false,
      });
      return tx.securitiesReceipt.update({
        where: { id: paper.id },
        data: {
          destinationAccountId: paper.destinationAccountId || notesAccountId,
          depositAccountId: debitAccountId,
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
    if (isOpeningPaper(paper)) {
      if (await companyOpeningJournalIsPosted(ctx.companyId)) {
        throw new AppError(400, OPENING_JOURNAL_UNPOST_FIRST_MESSAGE);
      }
      const note = input.description?.trim();
      const posted = await prisma.$transaction(async (tx) => {
        const deposits = await tx.journalEntry.findMany({
          where: {
            companyId: ctx.companyId,
            sourceId: paper.id,
            entryType: PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT,
            deletedAt: null,
            isCancelled: false,
            reversalOfJournalEntryId: null,
          },
          select: { id: true, date: true },
        });
        for (const deposit of deposits) {
          const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, deposit.date);
          const ready = await this.withResolvedBranch(ctx, paper.branchId);
          await this.unpostCommercialPaperJournalInTx(tx, ready, fiscalYearId, deposit.id);
        }
        const patch = {
          paperCase: PAPER_LIFECYCLE.BOUNCED,
          isCancelled: true,
          cancelledAt: new Date(),
          isPosted: false,
          postedAt: null,
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
    assertPaperIssued(paper, 'الارتداد');

    if (!(await this.isJournalActive(ctx.companyId, paper.journalEntryId))) {
      await this.syncIssueJournal(ctx, paperKind, paperId);
      paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    }

    const note = input.description?.trim();
    const bounceDate = asDate(input.date);
    const number = paperNumberOf(paper);
    const amount = money(Number(paper.amount));
    const notesAccountId = await this.notesAccountId(
      ctx.companyId,
      paperKind,
      paper.destinationAccountId
    );
    const partyAccountId = await this.partyAccountId(ctx.companyId, paperKind, paper);

    const posted = await prisma.$transaction(async (tx) => {
      const existingBounce = await tx.journalEntry.findFirst({
        where: {
          companyId: ctx.companyId,
          sourceId: paper.id,
          entryType: PAPER_JOURNAL_ENTRY_TYPE.BOUNCE,
          deletedAt: null,
          isCancelled: false,
          reversalOfJournalEntryId: null,
        },
        select: { id: true },
      });
      if (existingBounce) {
        throw new AppError(400, 'الورقة مرتدة بالفعل');
      }

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

      const postBounce = async (lines: JournalEntryLineData[], suffix: string) => {
        const base = note || paperJournalLabel(PAPER_JOURNAL_ENTRY_TYPE.BOUNCE, number);
        await this.postPaperJournal(tx, ctx, {
          paperKind,
          paper,
          date: bounceDate,
          description: suffix ? `${base} — ${suffix}` : base,
          entryType: PAPER_JOURNAL_ENTRY_TYPE.BOUNCE,
          lines,
          claimActiveSourceKey: false,
        });
      };

      let postedAny = false;
      for (const source of ordered) {
        if (!(await this.isJournalActive(ctx.companyId, source.id))) continue;
        const suffix =
          source.entryType === PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT ? 'عكس إيداع' : 'عكس تحرير';
        await postBounce(invertJournalLines(source.lines), suffix);
        postedAny = true;
      }

      if (!postedAny) {
        await postBounce(
          buildIssuedBounceLines(paperKind, {
            notesAccountId,
            partyAccountId,
            amount,
            costCenterId: input.costCenterId,
            description: note,
          }),
          'عكس تحرير'
        );
      }

      const patch = {
        paperCase: PAPER_LIFECYCLE.BOUNCED,
        isCancelled: true,
        cancelledAt: new Date(),
        isPosted: false,
        postedAt: null,
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
      select: { id: true, accountKind: true },
    });
    if (!account) throw new AppError(400, 'الحساب المختار غير موجود');
    if (account.accountKind !== 'POSTING') {
      throw new AppError(400, 'اختَر حساب حركة من الشجرة، ليس حساباً رئيسياً');
    }

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
    const endorsee = await this.resolveEndorseeSupplier(ctx.companyId, input.supplierId, input.accountId);

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
          endorseeSupplierId: endorsee?.id ?? null,
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
      return tx.securitiesReceipt.update({
        where: { id: paper.id },
        data: {
          ...this.issuedAfterUndoPatch(
            await this.isJournalActive(ctx.companyId, paper.journalEntryId),
            paper.postedAt
          ),
          endorseeSupplierId: null,
        },
        include: { customer: true, supplier: true },
      });
    });
    return this.decoratePaper(ctx.companyId, paperKind, updated);
  }

  async cancelIssuedPaperJournals(
    ctx: CommercialPaperPostingCtx,
    paperKind: CommercialPaperKind,
    paperId: string
  ) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    if (paper.isCancelled) {
      throw new AppError(400, 'الورقة ملغاة بالفعل');
    }
    if (paper.paperCase !== PAPER_LIFECYCLE.ISSUED) {
      throw new AppError(400, 'لا يمكن إلغاء ورقة بعد التحصيل أو التظهير. فك العملية أولاً');
    }
    return prisma.$transaction(async (tx) => {
      await this.cancelActiveJournalsOfType(tx, ctx, paperId, [
        PAPER_JOURNAL_ENTRY_TYPE.ISSUE,
        PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT,
        paperKind === 'PAYMENT' ? 'SecuritiesPayment' : 'SecuritiesReceipt',
      ]);

      return this.updatePaper(
        paperKind,
        paper.id,
        {
          isCancelled: true,
          cancelledAt: new Date(),
          paperCase: PAPER_LIFECYCLE.BOUNCED,
          isPosted: false,
        },
        tx
      );
    });
  }

  async restorePaper(ctx: CommercialPaperPostingCtx, paperKind: CommercialPaperKind, paperId: string) {
    const paper = await this.loadPaper(ctx.companyId, paperKind, paperId);
    if (!paper.isCancelled && paper.paperCase !== PAPER_LIFECYCLE.BOUNCED) {
      throw new AppError(400, 'الورقة ليست مرتدة');
    }

    const bounceJournals = await prisma.journalEntry.findMany({
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

    const updated = await prisma.$transaction(async (tx) => {
      await this.cancelActiveJournalsOfType(tx, ctx, paper.id, [PAPER_JOURNAL_ENTRY_TYPE.BOUNCE]);
      const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, paper.date);
      const ready = await this.withResolvedBranch(ctx, paper.branchId);
      const postingCtx = this.postingCtx(ready, fiscalYearId);
      const originals = await tx.journalEntry.findMany({
        where: {
          companyId: ctx.companyId,
          deletedAt: null,
          isCancelled: false,
          reversalOfJournalEntryId: null,
          OR: [
            {
              sourceId: paper.id,
              entryType: {
                in: [
                  PAPER_JOURNAL_ENTRY_TYPE.DEPOSIT,
                  PAPER_JOURNAL_ENTRY_TYPE.ISSUE,
                  'SecuritiesReceipt',
                  'SecuritiesPayment',
                ],
              },
            },
            ...(paper.journalEntryId ? [{ id: paper.journalEntryId }] : []),
          ],
        },
        select: { id: true, isPosted: true, postingStatus: true },
      });
      let reposted = false;
      for (const row of originals) {
        if (row.isPosted || row.postingStatus === 'Post') continue;
        await journalPostingService.repostSourceJournalInTx(tx, postingCtx, row.id);
        reposted = true;
      }
      const issuePosted = originals.some((row) => row.isPosted || row.postingStatus === 'Post') || reposted;
      return this.updatePaper(
        paperKind,
        paper.id,
        {
          ...this.issuedAfterUndoPatch(issuePosted || hadBounceJournal, paper.postedAt),
          isPosted: issuePosted || hadBounceJournal,
        },
        tx
      );
    });
    if (!hadBounceJournal && !paper.journalEntryId) {
      return this.syncIssueJournal(ctx, paperKind, paperId);
    }
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
    const fullCollect = await prisma.journalEntry.findFirst({
      where: {
        companyId: ctx.companyId,
        sourceId: paper.id,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.COLLECT,
        deletedAt: null,
        isCancelled: false,
        reversalOfJournalEntryId: null,
      },
      select: { id: true },
    });
    if (fullCollect) {
      throw new AppError(400, 'الورقة محصّلة بالفعل ولا يمكن تحصيلها مرة أخرى');
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
    const lines =
      paperKind === 'PAYMENT'
        ? buildPaymentCollectLines({
            notesAccountId: creditAccountId,
            partyAccountId: creditAccountId,
            bankAccountId: debitAccountId,
            amount,
            description: note,
          })
        : [
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
          ];

    const posted = await prisma.$transaction(async (tx) => {
      await this.postPaperJournal(tx, ctx, {
        paperKind,
        paper,
        date: collectionDate,
        description: note,
        entryType: PAPER_JOURNAL_ENTRY_TYPE.MULTI,
        lines,
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
