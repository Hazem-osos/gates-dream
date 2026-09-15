import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { assertExpectedVersion, throwStaleWrite } from '../../../shared/concurrency/optimistic-lock';
import { logger } from '../../../shared/logger';
import { amountsEqualAt4, roundTo4 } from '../../../shared/utils/decimal-round';
import {
  mulToDecimal4,
  sumBaseLines,
  toDecimal4,
  validateJournalLineSides,
} from '../../../shared/utils/money.util';
import { companySettingService } from '../../platform/services/company-setting.service';
import { advancedRightsService } from '../../platform/services/advanced-rights.service';
import { approvalWorkflowService } from './approval-workflow.service';
import { documentAuditService } from './document-audit.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { journalReversalDescription } from '../constants/ledger-integrity';
import { applyPostedJournalBalancesInTx } from './ledger-balance.service';
import { glAccountResolver } from './gl-account-resolver.service';
import type {
  CreateJournalEntryData,
  JournalEntryLineData,
  UpdateJournalEntryData,
} from '../types/journal-entry.types';
import { resolveHijriDate } from '../../../shared/utils/hijri-date';
import {
  persistJournalSourceType,
  resolveJournalSourceKind,
} from '../utils/journal-source';
import { recurringEntriesService } from './recurring-entries.service';
import { JournalSourceType } from '@prisma/client';

function journalNumberKeys(value: string | null | undefined): string[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];
  const keys = new Set([trimmed]);
  if (/^\d+$/.test(trimmed)) {
    keys.add(trimmed.replace(/^0+/, '') || '0');
    keys.add(trimmed.padStart(8, '0').slice(-8));
  }
  return [...keys];
}

export interface JournalPostingContext {
  companyId: string;
  branchId: string;
  fiscalYearId?: string;
  userId: string;
  /** JWT `admin` role — bypasses per-user `AdvancedRights` (GLPost/GLUnPost). */
  isAdmin?: boolean;
}

export class JournalPostingService {
  /**
   * H2 fix: the (companyId, sourceType, sourceNumber, sourceYearId) triple
   * identifying a source document's *currently active* posted entry. Kept
   * NULL on historical/reversed rows so MySQL's unique-index semantics
   * (NULLs are distinct) never block a legitimate re-post.
   */
  buildActiveSourceKey(
    companyId: string,
    sourceType?: string | null,
    sourceNumber?: string | null,
    sourceYearId?: string | null
  ): string | undefined {
    if (!sourceType || !sourceNumber) return undefined;
    return `${companyId}|${sourceType}|${sourceNumber}|${sourceYearId ?? ''}`;
  }

  /**
   * Sum(debit * rate) and sum(credit * rate) with RoundTo(..., -4) — legacy UntGL CalTotals.
   */
  computeBaseTotals(
    lines: Array<{ debit: number; credit: number; exchangeRate?: number }>
  ): { debitBase: number; creditBase: number } {
    return sumBaseLines(lines);
  }

  validateDoubleEntryBalance(
    lines: Array<{ debit: number; credit: number; exchangeRate?: number }>,
    options: { allowUnbalanced: boolean; requireStrictLines?: boolean }
  ): { isBalanced: boolean } {
    if (options.requireStrictLines !== false) {
      validateJournalLineSides(lines);
    }
    const { debitBase, creditBase } = this.computeBaseTotals(lines);
    const isBalanced = amountsEqualAt4(debitBase, creditBase);
    if (!isBalanced && !options.allowUnbalanced) {
      throw new AppError(
        422,
        `القيد غير متزن: إجمالي المدين ${debitBase} لا يساوي إجمالي الدائن ${creditBase}`
      );
    }
    return { isBalanced };
  }

  private buildLineRows(
    journalEntryId: string,
    lines: JournalEntryLineData[],
    headerRate: number
  ) {
    return lines.map((line) => {
      const rate = new Decimal(line.exchangeRate ?? headerRate);
      const debit = toDecimal4(line.debit);
      const credit = toDecimal4(line.credit);
      return {
        journalEntryId,
        lineNumber: line.lineOrder,
        accountId: line.accountId,
        costCenterId: line.costCenterId,
        description: line.description,
        debit,
        credit,
        exchangeRate: rate,
        debitBase: mulToDecimal4(debit, rate),
        creditBase: mulToDecimal4(credit, rate),
        lineOrder: line.lineOrder,
        partnerId: line.partnerId,
        partnerType: line.partnerType,
        isTiedToInvoice: Boolean(line.isTiedToInvoice && line.invoiceId),
        invoiceId: line.isTiedToInvoice && line.invoiceId ? line.invoiceId : null,
        invoiceNumber:
          line.isTiedToInvoice && line.invoiceId
            ? line.invoiceNumber ?? null
            : null,
      };
    });
  }

  private async assertJournalNumberFree(
    companyId: string,
    number: string | null | undefined,
    excludeId?: string
  ) {
    const keys = journalNumberKeys(number);
    if (keys.length === 0) return;

    const clash = await prisma.journalEntry.findFirst({
      where: {
        companyId,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        OR: [{ voucherNumber: { in: keys } }, { legacyGlNum: { in: keys } }],
      },
      select: { id: true },
    });
    if (clash) {
      throw new AppError(409, 'رقم السند مستخدم من قبل. غيّر الرقم ثم احفظ.');
    }
  }

  private journalInclude() {
    return {
      lines: {
        include: {
          account: { select: { id: true, code: true, arabicName: true } },
          costCenter: { select: { id: true, code: true, arabicName: true } },
        },
        orderBy: { lineOrder: 'asc' as const },
      },
    };
  }

  private async syncCyclicRecurringTemplate(
    companyId: string,
    journalEntryId: string,
    input: {
      sourceId?: string | null;
      description?: string | null;
      voucherNumber?: string | null;
      date: Date;
      lines: JournalEntryLineData[];
    }
  ) {
    const template = await recurringEntriesService.upsertFromJournal(companyId, {
      id: journalEntryId,
      sourceId: input.sourceId,
      description: input.description,
      voucherNumber: input.voucherNumber,
      date: input.date,
      lines: input.lines.map((line) => ({
        accountId: line.accountId,
        costCenterId: line.costCenterId,
        description: line.description,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
      })),
    });

    await prisma.journalEntry.update({
      where: { id: journalEntryId },
      data: {
        isCyclic: true,
        isRecurring: true,
        sourceId: template.id,
        sourceNumber: template.templateNameAr,
      },
    });

    return prisma.journalEntry.findUnique({
      where: { id: journalEntryId },
      include: this.journalInclude(),
    });
  }

  async createJournalEntry(
    ctx: JournalPostingContext,
    data: CreateJournalEntryData & { entryType?: string; exchangeRate?: number }
  ) {
    const saveUnbalanced = await companySettingService.getFlag(
      ctx.companyId,
      'SaveUnbalanced',
      false
    );
    const headerRate = data.exchangeRate ?? 1;
    const lineInputs = data.lines.map((l) => ({
      debit: l.debit,
      credit: l.credit,
      exchangeRate: l.exchangeRate ?? headerRate,
    }));
    const { isBalanced } = this.validateDoubleEntryBalance(lineInputs, {
      allowUnbalanced: saveUnbalanced,
    });

    const isOpening = (data.entryType ?? '').toUpperCase() === 'OPENING_BALANCE';
    const fiscalYearIdFromDate = await fiscalYearService.assertOpenForDate(
      ctx.companyId,
      data.date,
      { allowOpeningDocument: isOpening }
    );
    if (ctx.fiscalYearId && ctx.fiscalYearId !== fiscalYearIdFromDate && !isOpening) {
      throw new AppError(422, 'Document date is outside the header fiscal year');
    }
    const fiscalYearId = fiscalYearIdFromDate;

    const lines = await glAccountResolver.enforceCostCenters(
      prisma,
      ctx.companyId,
      data.lines
    );

    const requestedNumber = data.voucherNumber?.trim() || undefined;
    await this.assertJournalNumberFree(ctx.companyId, requestedNumber);
    let legacyGlNum = await documentSequenceService.nextGlNumber(
      {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        fiscalYearId,
      },
      requestedNumber,
      { forceAutomatic: !requestedNumber }
    );
    if (requestedNumber && legacyGlNum === requestedNumber && /^\d+$/.test(requestedNumber)) {
      legacyGlNum = requestedNumber.padStart(8, '0').slice(-8);
      await this.assertJournalNumberFree(ctx.companyId, legacyGlNum);
    }
    const persistedNumber = requestedNumber ?? legacyGlNum;

    const sourceKind = resolveJournalSourceKind(data.sourceType, data.sourceKind);
    const sourceType = persistJournalSourceType(data.sourceType, sourceKind);
    const isRecurring =
      data.isRecurring ?? sourceKind === JournalSourceType.RECURRING_TEMPLATE;

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.journalEntry.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          fiscalYearId,
          legacyGlNum,
          voucherNumber: persistedNumber,
          date: data.date,
          hijriDate: resolveHijriDate(data.date, data.hijriDate),
          description: data.description,
          currencyCode: data.currencyCode,
          exchangeRate: new Decimal(headerRate),
          postingStatus: 'UnPost',
          documentStatus: 'Open',
          isBalanced,
          isPosted: false,
          isApproved: false,
          isCyclic: data.isCyclic ?? isRecurring,
          isRecurring,
          isCancelled: false,
          entryType: data.entryType ?? 'MANUAL',
          sourceType,
          sourceId: data.sourceId,
          sourceNumber: data.sourceNumber,
          sourceKind,
          workflowStatus: 'APPROVED',
          createdBy: ctx.userId,
        },
      });

      await tx.journalEntryLine.createMany({
        data: this.buildLineRows(created.id, lines, headerRate),
      });

      // C12 fix: recorded *inside* this transaction (passing `tx`) rather
      // than after it commits — previously a crash/restart between commit
      // and this call meant a manual journal entry could exist with no
      // audit row, and the corresponding row could not be rolled back with
      // it either.
      await documentAuditService.record(
        {
          companyId: ctx.companyId,
          entityType: 'JOURNAL_ENTRY',
          entityId: created.id,
          action: 'CREATED',
          userId: ctx.userId,
        },
        tx
      );

      return tx.journalEntry.findUnique({
        where: { id: created.id },
        include: this.journalInclude(),
      });
    });

    if (data.isCyclic) {
      const synced = await this.syncCyclicRecurringTemplate(ctx.companyId, entry!.id, {
        sourceId: data.sourceId ?? entry?.sourceId,
        description: data.description,
        voucherNumber: data.voucherNumber ?? entry?.voucherNumber,
        date: data.date,
        lines,
      });
      if (ctx.isAdmin && synced?.id && !synced.isPosted) {
        return this.postJournalEntry(ctx, synced.id);
      }
      return synced;
    }
    if (sourceKind === JournalSourceType.RECURRING_TEMPLATE && data.sourceId) {
      await recurringEntriesService.markGenerated(ctx.companyId, data.sourceId);
    }

    logger.info(
      { companyId: ctx.companyId, journalEntryId: entry!.id, legacyGlNum },
      'Journal entry created (posting service)'
    );

    if (ctx.isAdmin && entry?.id) {
      return this.postJournalEntry(ctx, entry.id);
    }
    return entry;
  }

  /**
   * Create + post a balanced journal entry inside an existing transaction (invoice posting).
   */
  async createAndPostInTx(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext,
    data: CreateJournalEntryData & {
      entryType?: string;
      exchangeRate?: number;
      sourceType?: string;
      sourceNumber?: string;
      sourceYearId?: string;
      sourceId?: string;
      fiscalYearId: string;
      legacyGlNum?: string;
      /**
       * Reversal entries carry the same sourceType/sourceNumber/sourceYearId
       * as the original for traceability, but must never claim the
       * activeSourceKey slot — the source document has no *active* GL
       * effect while it sits reversed. Defaults to true.
       */
      claimActiveSourceKey?: boolean;
      /**
       * Reversal path writes the contra JE then applies -1 × original
       * amounts via applyPostedJournalBalancesInTx({ invert: true }).
       */
      skipBalanceApply?: boolean;
    }
  ) {
    const glPost = await companySettingService.getFlag(ctx.companyId, 'GLPost', true);
    if (!glPost) {
      throw new AppError(403, 'Posting to general ledger is disabled for this company');
    }

    // M2/M3 fix: this is the single GL entry point used by invoices, treasury,
    // payroll, POS, contracting, etc. — it previously skipped the fiscal
    // year/period lock entirely (the open-year guard only ran for manual GL
    // entries via createJournalEntry). Every document-driven posting must be
    // rejected once its *document date* falls in a closed year or period.
    await fiscalYearService.assertOpenForDate(ctx.companyId, data.date, {
      allowOpeningDocument: (data.entryType ?? '').toUpperCase() === 'OPENING_BALANCE',
    });

    const headerRate = data.exchangeRate ?? 1;
    const lineInputs = data.lines.map((l) => ({
      debit: l.debit,
      credit: l.credit,
      exchangeRate: l.exchangeRate ?? headerRate,
    }));
    validateJournalLineSides(lineInputs);
    const { isBalanced } = this.validateDoubleEntryBalance(lineInputs, {
      allowUnbalanced: false,
      requireStrictLines: false,
    });

    const created = await tx.journalEntry.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        fiscalYearId: data.fiscalYearId,
        legacyGlNum: data.legacyGlNum,
        date: data.date,
        hijriDate: resolveHijriDate(data.date, data.hijriDate),
        description: data.description,
        currencyCode: data.currencyCode,
        exchangeRate: new Decimal(headerRate),
        postingStatus: 'Post',
        documentStatus: 'Open',
        isBalanced,
        isPosted: true,
        isApproved: false,
        isCyclic: false,
        isCancelled: false,
        entryType: data.entryType ?? 'Invoice',
        sourceType: data.sourceType,
        sourceNumber: data.sourceNumber,
        sourceYearId: data.sourceYearId,
        sourceId: data.sourceId,
        sourceKind: resolveJournalSourceKind(data.sourceType),
        activeSourceKey:
          data.claimActiveSourceKey === false
            ? undefined
            : this.buildActiveSourceKey(
                ctx.companyId,
                data.sourceType,
                data.sourceNumber,
                data.sourceYearId
              ),
        postedAt: new Date(),
        postedBy: ctx.userId,
        createdBy: ctx.userId,
      },
    });

    const postedLines = this.buildLineRows(created.id, data.lines, headerRate);
    await tx.journalEntryLine.createMany({
      data: postedLines,
    });

    if (!data.skipBalanceApply) {
      await applyPostedJournalBalancesInTx(tx, {
        companyId: ctx.companyId,
        date: data.date,
        currencyCode: data.currencyCode,
        lines: postedLines,
      });
    }

    // C12 fix: this is the single GL entry point used by invoices, treasury,
    // payroll, POS, contracting, etc. (see the M2/M3 fix comment above) — it
    // previously had *no* audit call at all, so the large majority of
    // document postings left no audit trail. Recorded inside the caller's
    // own transaction (`tx`), so the audit row and the GL posting it
    // describes are created and rolled back together.
    await documentAuditService.record(
      {
        companyId: ctx.companyId,
        entityType: 'JOURNAL_ENTRY',
        entityId: created.id,
        action: 'POSTED',
        userId: ctx.userId,
        metadata: {
          sourceType: data.sourceType,
          sourceNumber: data.sourceNumber,
          sourceYearId: data.sourceYearId,
        },
      },
      tx
    );

    return created;
  }

  /**
   * C11 fix — reverse a posted journal entry with a dated contra entry
   * instead of flag-flipping it back to "unposted". The original stays
   * posted forever (an immutable accounting fact); the contra entry
   * (debit/credit swapped line-for-line) neutralizes its net effect and
   * is linked back via `reversalOfJournalEntryId`. Idempotent: reversing
   * an already-reversed entry returns the existing reversal instead of
   * erroring, since callers (invoice/treasury/cheque unpost) may retry.
   */
  async reverseJournalEntryInTx(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext,
    journalEntryId: string,
    opts?: { date?: Date; reason?: string }
  ) {
    const original = await tx.journalEntry.findFirst({
      where: { id: journalEntryId, companyId: ctx.companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!original) {
      throw new AppError(404, 'Journal entry not found');
    }
    if (original.deletedAt) {
      throw new AppError(400, 'Journal entry is deleted');
    }
    if (!original.isPosted) {
      throw new AppError(400, 'Cannot reverse a journal entry that is not posted');
    }

    const existingReversal = await tx.journalEntry.findFirst({
      where: { reversalOfJournalEntryId: original.id },
      include: this.journalInclude(),
    });
    if (existingReversal) {
      return { original, reversal: existingReversal };
    }

    const reversalDate = opts?.date ?? original.date;
    const contraLines: JournalEntryLineData[] = original.lines.map((line) => ({
      accountId: line.accountId,
      costCenterId: line.costCenterId ?? undefined,
      debit: Number(line.credit),
      credit: Number(line.debit),
      exchangeRate: Number(line.exchangeRate),
      description: line.description ?? undefined,
      lineOrder: line.lineOrder,
      partnerId: line.partnerId ?? undefined,
      partnerType:
        line.partnerType === 'CUSTOMER' || line.partnerType === 'SUPPLIER'
          ? line.partnerType
          : undefined,
      isTiedToInvoice: Boolean(line.isTiedToInvoice && line.invoiceId),
      invoiceId: line.invoiceId ?? null,
      invoiceNumber: line.invoiceNumber ?? null,
    }));

    const originalNumber =
      original.voucherNumber ?? original.legacyGlNum ?? original.id.slice(0, 8);
    const reversal = await this.createAndPostInTx(tx, ctx, {
      date: reversalDate,
      hijriDate: original.hijriDate ?? undefined,
      description: journalReversalDescription(originalNumber, opts?.reason),
      currencyCode: original.currencyCode,
      exchangeRate: Number(original.exchangeRate),
      fiscalYearId: original.fiscalYearId ?? ctx.fiscalYearId!,
      // entryType is VARCHAR(20) — keep a fixed short tag; the link back to
      // the original (with its own entryType) is `reversalOfJournalEntryId`.
      entryType: 'REVERSAL',
      // Same source triple as the original for traceability/grouping in
      // reports, but claimActiveSourceKey: false so it never fights the
      // original (or a future re-post) for the unique activeSourceKey slot.
      sourceType: original.sourceType ?? undefined,
      sourceNumber: original.sourceNumber ?? undefined,
      sourceYearId: original.sourceYearId ?? undefined,
      claimActiveSourceKey: false,
      skipBalanceApply: true,
      lines: contraLines,
    });

    // Subtract the original (unswapped) amounts so period/partner totals
    // shrink instead of booking a second debit+credit pair.
    await applyPostedJournalBalancesInTx(tx, {
      companyId: ctx.companyId,
      date: reversalDate,
      currencyCode: original.currencyCode,
      invert: true,
      lines: original.lines,
    });

    await tx.journalEntry.update({
      where: { id: reversal.id },
      data: { reversalOfJournalEntryId: original.id },
    });

    if (original.activeSourceKey) {
      await tx.journalEntry.update({
        where: { id: original.id },
        data: { activeSourceKey: null },
      });
    }

    await documentAuditService.record(
      {
        companyId: ctx.companyId,
        entityType: 'JOURNAL_ENTRY',
        entityId: original.id,
        action: 'REVERSED',
        userId: ctx.userId,
      },
      tx
    );

    const reversalWithLines = await tx.journalEntry.findUnique({
      where: { id: reversal.id },
      include: this.journalInclude(),
    });

    return { original, reversal: reversalWithLines! };
  }

  async reverseJournalEntry(
    ctx: JournalPostingContext,
    journalEntryId: string,
    opts?: { date?: Date; reason?: string }
  ) {
    return prisma.$transaction((tx) =>
      this.reverseJournalEntryInTx(tx, ctx, journalEntryId, opts)
    );
  }

  async updateJournalEntry(
    ctx: JournalPostingContext,
    journalEntryId: string,
    data: UpdateJournalEntryData & { exchangeRate?: number }
  ) {
    const existing = await prisma.journalEntry.findFirst({
      where: { id: journalEntryId, companyId: ctx.companyId },
    });

    if (!existing) {
      throw new AppError(404, 'Journal entry not found');
    }
    if (existing.deletedAt) {
      throw new AppError(400, 'Journal entry is deleted');
    }
    if (existing.postingStatus === 'Post' || existing.isPosted) {
      throw new AppError(
        400,
        'القيد مرحّل ولا يمكن تعديله. فك الترحيل أولاً من قائمة (...).'
      );
    }
    if (existing.isCancelled) {
      throw new AppError(400, 'القيد ملغي ولا يمكن تعديله');
    }
    if (data.voucherNumber !== undefined) {
      const nextNumber = data.voucherNumber?.trim() || undefined;
      data.voucherNumber = nextNumber;
      if (nextNumber) {
        await this.assertJournalNumberFree(ctx.companyId, nextNumber, journalEntryId);
      }
    }
    // M14 fix (Item 40): if the client tells us which version it edited,
    // reject the edit outright when the DB has already moved past that —
    // catches the "form left open, someone else edited it in the
    // meantime" case that the transactional guard below (which only
    // protects the narrow window of this request's own lifetime) cannot.
    assertExpectedVersion(existing.version, data.expectedVersion);

    const entryDate = data.date ?? existing.date;
    const isOpeningUpdate = (data.entryType ?? existing.entryType ?? '').toUpperCase() === 'OPENING_BALANCE';
    await fiscalYearService.assertOpenForDate(ctx.companyId, entryDate, {
      allowOpeningDocument: isOpeningUpdate,
    });

    const saveUnbalanced = await companySettingService.getFlag(
      ctx.companyId,
      'SaveUnbalanced',
      false
    );
    const headerRate =
      data.exchangeRate ?? Number(existing.exchangeRate ?? 1);

    if (data.lines) {
      data.lines = await glAccountResolver.enforceCostCenters(
        prisma,
        ctx.companyId,
        data.lines
      );
      this.validateDoubleEntryBalance(
        data.lines.map((l) => ({
          debit: l.debit,
          credit: l.credit,
          exchangeRate: l.exchangeRate ?? headerRate,
        })),
        { allowUnbalanced: saveUnbalanced }
      );
    }

    return prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (data.voucherNumber !== undefined) updateData.voucherNumber = data.voucherNumber;
      if (data.date !== undefined) updateData.date = data.date;
      updateData.hijriDate = resolveHijriDate(
        data.date ?? existing.date,
        data.hijriDate !== undefined ? data.hijriDate : existing.hijriDate
      );
      if (data.description !== undefined) updateData.description = data.description;
      if (data.currencyCode !== undefined) updateData.currencyCode = data.currencyCode;
      if (data.isCyclic !== undefined) updateData.isCyclic = data.isCyclic;
      if (data.entryType !== undefined) updateData.entryType = data.entryType;
      if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;
      if (data.sourceType !== undefined || data.sourceKind !== undefined) {
        const sourceKind = resolveJournalSourceKind(
          data.sourceType ?? existing.sourceType,
          data.sourceKind ?? existing.sourceKind
        );
        updateData.sourceKind = sourceKind;
        if (data.sourceType !== undefined) {
          updateData.sourceType = persistJournalSourceType(data.sourceType, sourceKind);
        }
        if (data.isRecurring === undefined) {
          updateData.isRecurring = sourceKind === JournalSourceType.RECURRING_TEMPLATE;
        }
      }
      if (data.sourceId !== undefined) updateData.sourceId = data.sourceId;
      if (data.sourceNumber !== undefined) updateData.sourceNumber = data.sourceNumber;
      if (data.exchangeRate !== undefined) {
        updateData.exchangeRate = new Decimal(data.exchangeRate);
      }

      if (data.lines) {
        const { isBalanced } = this.validateDoubleEntryBalance(
          data.lines.map((l) => ({
            debit: l.debit,
            credit: l.credit,
            exchangeRate: l.exchangeRate ?? headerRate,
          })),
          { allowUnbalanced: saveUnbalanced }
        );
        updateData.isBalanced = isBalanced;
      }

      // M14 fix (Item 40): guard the write itself with the version this
      // function read at the top — if another transaction updated (and
      // thus bumped) the row between our read and this write, `count`
      // comes back 0 and we surface a 409 instead of silently clobbering
      // the other writer's changes with stale data.
      updateData.version = { increment: 1 };
      const updateResult = await tx.journalEntry.updateMany({
        where: { id: journalEntryId, version: existing.version },
        data: updateData,
      });
      if (updateResult.count === 0) {
        throwStaleWrite();
      }

      if (data.lines) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId } });
        await tx.journalEntryLine.createMany({
          data: this.buildLineRows(journalEntryId, data.lines, headerRate),
        });
      }

      await documentAuditService.record(
        {
          companyId: ctx.companyId,
          entityType: 'JOURNAL_ENTRY',
          entityId: journalEntryId,
          action: 'UPDATED',
          userId: ctx.userId,
        },
        tx
      );

      return tx.journalEntry.findUnique({
        where: { id: journalEntryId },
        include: this.journalInclude(),
      });
    });

    const cyclic = data.isCyclic ?? existing.isCyclic;
    const synced = cyclic
      ? await this.syncCyclicRecurringTemplate(ctx.companyId, journalEntryId, {
          sourceId: data.sourceId ?? existing.sourceId,
          description: data.description ?? existing.description,
          voucherNumber: data.voucherNumber ?? existing.voucherNumber,
          date: data.date ?? existing.date,
          lines: (
            data.lines ??
            (await prisma.journalEntryLine.findMany({
              where: { journalEntryId },
              orderBy: { lineOrder: 'asc' },
            }))
          ).map((line, index) => ({
            accountId: line.accountId,
            costCenterId: line.costCenterId,
            description: line.description,
            debit: Number(line.debit) || 0,
            credit: Number(line.credit) || 0,
            lineOrder: 'lineOrder' in line ? Number(line.lineOrder) || index + 1 : index + 1,
          })),
        })
      : updated;

    if (ctx.isAdmin && synced?.id && !synced.isPosted) {
      return this.postJournalEntry(ctx, synced.id);
    }
    return synced;
  }

  async postJournalEntry(ctx: JournalPostingContext, journalEntryId: string) {
    const glPost = await companySettingService.getFlag(ctx.companyId, 'GLPost', true);
    if (!glPost) {
      throw new AppError(403, 'Posting to general ledger is disabled for this company');
    }
    await advancedRightsService.assertCanPostFamily(ctx.companyId, ctx.userId, ctx.branchId, 'glPost', {
      isAdmin: ctx.isAdmin,
      actionLabel: 'post general ledger vouchers',
    });

    await approvalWorkflowService.assertCanPostJournal(ctx.companyId, journalEntryId, ctx.userId);

    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({
        where: { id: journalEntryId, companyId: ctx.companyId },
        include: { lines: true },
      });

      if (!entry) {
        throw new AppError(404, 'Journal entry not found');
      }
      if (entry.deletedAt) {
        throw new AppError(400, 'Journal entry is deleted');
      }
      if (entry.branchId && entry.branchId !== ctx.branchId) {
        throw new AppError(403, 'Journal entry belongs to a different branch');
      }
      if (entry.postingStatus === 'Post' || entry.isPosted) {
        throw new AppError(400, 'Journal entry is already posted');
      }
      if (entry.documentStatus !== 'Open') {
        throw new AppError(400, 'Journal entry document is not open for posting');
      }
      if (!entry.isBalanced) {
        throw new AppError(422, 'لا يمكن ترحيل قيد غير متزن. ساوِ إجمالي المدين مع إجمالي الدائن ثم أعد الحفظ.');
      }
      if (entry.isCancelled) {
        throw new AppError(400, 'Cannot post a cancelled journal entry');
      }

      await fiscalYearService.assertOpenForDate(ctx.companyId, entry.date, {
        allowOpeningDocument: (entry.entryType ?? '').toUpperCase() === 'OPENING_BALANCE',
      });

      const { debitBase, creditBase } = this.computeBaseTotals(
        entry.lines.map((l) => ({
          debit: Number(l.debit),
          credit: Number(l.credit),
          exchangeRate: Number(l.exchangeRate),
        }))
      );
      if (!amountsEqualAt4(debitBase, creditBase)) {
        throw new AppError(422, 'Cannot post: debit and credit base totals differ');
      }

      // Wave 4 fix: the findFirst above is a plain read, so two concurrent
      // postJournalEntry calls for the same entry can both pass the
      // "not already posted" check before either writes. Guard the write
      // itself with a conditional updateMany keyed on the still-unposted
      // state; MySQL's row lock on the matched row means only one
      // concurrent transaction can win the race, and the loser sees
      // count === 0 and fails instead of double-posting.
      const { count } = await tx.journalEntry.updateMany({
        where: { id: journalEntryId, isPosted: false, postingStatus: { not: 'Post' } },
        data: {
          isPosted: true,
          postingStatus: 'Post',
          workflowStatus: 'POSTED',
          postedAt: new Date(),
          postedBy: ctx.userId,
        },
      });
      if (count === 0) {
        throw new AppError(409, 'Journal entry was already posted by another process');
      }

      await applyPostedJournalBalancesInTx(tx, {
        companyId: ctx.companyId,
        date: entry.date,
        currencyCode: entry.currencyCode,
        lines: entry.lines,
      });

      const posted = await tx.journalEntry.findFirstOrThrow({
        where: { id: journalEntryId },
        include: this.journalInclude(),
      });

      await documentAuditService.record(
        {
          companyId: ctx.companyId,
          entityType: 'JOURNAL_ENTRY',
          entityId: journalEntryId,
          action: 'POSTED',
          userId: ctx.userId,
        },
        tx
      );

      return posted;
    });
  }

  async unpostJournalEntry(ctx: JournalPostingContext, journalEntryId: string) {
    const glUnPost = await companySettingService.getFlag(
      ctx.companyId,
      'GLUnPost',
      true
    );
    if (!glUnPost) {
      throw new AppError(403, 'فك ترحيل القيود مقفول لهذه الشركة');
    }
    await advancedRightsService.assertCanPostFamily(ctx.companyId, ctx.userId, ctx.branchId, 'glUnpost', {
      isAdmin: ctx.isAdmin,
      actionLabel: 'unpost general ledger vouchers',
    });

    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({
        where: { id: journalEntryId, companyId: ctx.companyId },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });

      if (!entry) {
        throw new AppError(404, 'القيد غير موجود');
      }
      if (entry.postingStatus !== 'Post' && !entry.isPosted) {
        throw new AppError(400, 'القيد غير مرحّل');
      }
      // Approval is a pre-post gate only. If no approval chain is configured
      // (or the owner is reversing their own post), unpost clears the flag.
      if (entry.branchId && ctx.branchId && entry.branchId !== ctx.branchId) {
        throw new AppError(403, 'القيد تابع لفرع آخر');
      }
      if (entry.entryType === 'REVERSAL' || entry.entryType === 'YearClose') {
        throw new AppError(422, 'لا يمكن فك ترحيل قيد عكسي أو قيد إقفال من هنا');
      }

      const autoGlSources = new Set([
        'SI',
        'PI',
        'SR',
        'PR',
        'CR',
        'CP',
        'CEP',
        'CKC',
        'CKB',
        'CKE',
      ]);
      if (entry.sourceType && autoGlSources.has(entry.sourceType)) {
        throw new AppError(
          422,
          'هذا القيد مربوط بمستند آخر. فك الترحيل من شاشة الفاتورة أو السند الأصلي.'
        );
      }

      const existingReversal = await tx.journalEntry.findFirst({
        where: { reversalOfJournalEntryId: entry.id },
        select: { id: true },
      });
      if (existingReversal) {
        throw new AppError(
          422,
          'هذا القيد عليه قيد عكسي. لا يمكن فك ترحيله للتعديل.'
        );
      }

      await fiscalYearService.assertOpenForDate(ctx.companyId, entry.date, {
        allowOpeningDocument: (entry.entryType ?? '').toUpperCase() === 'OPENING_BALANCE',
      });

      await applyPostedJournalBalancesInTx(tx, {
        companyId: ctx.companyId,
        date: entry.date,
        currencyCode: entry.currencyCode,
        invert: true,
        lines: entry.lines,
      });

      const unposted = await tx.journalEntry.update({
        where: { id: journalEntryId },
        data: {
          isPosted: false,
          isApproved: false,
          postingStatus: 'UnPost',
          workflowStatus: 'APPROVED',
          postedAt: null,
          postedBy: null,
          activeSourceKey: null,
        },
        include: this.journalInclude(),
      });

      await documentAuditService.record(
        {
          companyId: ctx.companyId,
          entityType: 'JOURNAL_ENTRY',
          entityId: journalEntryId,
          action: 'UNPOSTED',
          userId: ctx.userId,
        },
        tx
      );

      return unposted;
    });
  }
}

export const journalPostingService = new JournalPostingService();
