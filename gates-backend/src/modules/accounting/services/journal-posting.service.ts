import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { assertExpectedVersion, throwStaleWrite } from '../../../shared/concurrency/optimistic-lock';
import { logger } from '../../../shared/logger';
import { amountsEqualAt4 } from '../../../shared/utils/decimal-round';
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
import { applyPostedJournalBalancesInTx } from './ledger-balance.service';
import { glAccountResolver } from './gl-account-resolver.service';
import type {
  CreateJournalEntryData,
  JournalEntryLineData,
  UpdateJournalEntryData,
} from '../types/journal-entry.types';
import { resolveHijriDate } from '../../../shared/utils/hijri-date';
import {
  isSourcedJournalEntry,
  persistJournalSourceType,
  resolveJournalSourceKind,
  SOURCED_JOURNAL_MUTATION_MESSAGE,
} from '../utils/journal-source';
import { recurringEntriesService } from './recurring-entries.service';
import {
  assertSingleOpeningJournal,
  allowsOpeningDocumentDate,
  isCompanyOpeningEntry,
  isOpeningBalanceDraft,
  OPENING_JOURNAL_EXISTS_MESSAGE,
  openingJournalSlotKey,
} from './opening-balance.service';
import { JournalSourceType } from '@prisma/client';
import { isUnitRateCurrency, persistFxRate, persistJournalLineFxRate, rateForSave } from '../utils/company-fx-rate';
import { AUTOMATION_SYSTEM_ACTOR_ID } from '../../automation/constants';

async function hydrateEntryFx<T extends {
  currencyCode?: string | null;
  exchangeRate?: number | null;
  lines?: Array<{ currencyCode?: string | null; exchangeRate?: number | null }>;
}>(companyId: string, data: T): Promise<T> {
  const headerRate = await rateForSave(companyId, data.currencyCode, data.exchangeRate);
  data.exchangeRate = headerRate;
  if (data.lines) {
    for (const line of data.lines) {
      // A voucher leg can carry 2 USD @ 50 while the header stays EGP.
      // Resolving that leg as the header currency forces rate 1 and the
      // journal looks unbalanced even though the base amounts match.
      if (!line.currencyCode && line.exchangeRate != null && isUnitRateCurrency(data.currencyCode)) {
        const kept = persistJournalLineFxRate({
          headerCurrencyCode: data.currencyCode,
          lineRate: line.exchangeRate,
          headerRate,
        });
        if (kept !== 1) {
          line.exchangeRate = kept;
          continue;
        }
      }
      line.exchangeRate = await rateForSave(
        companyId,
        line.currencyCode || data.currencyCode,
        line.exchangeRate ?? headerRate
      );
    }
  }
  return data;
}

function lineFxRate(
  headerCurrencyCode: string | null | undefined,
  line: { exchangeRate?: number; currencyCode?: string | null },
  headerRate: number
): number {
  return persistJournalLineFxRate({
    headerCurrencyCode,
    lineCurrencyCode: line.currencyCode,
    lineRate: line.exchangeRate,
    headerRate,
  });
}

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
  branchId?: string | null;
  fiscalYearId?: string;
  userId: string;
  /** JWT `admin` role — bypasses per-user `AdvancedRights` (GLPost/GLUnPost). */
  isAdmin?: boolean;
}

function optionalBranchId(id?: string | null): string | undefined {
  const value = String(id ?? '').trim();
  return value || undefined;
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
    sourceYearId?: string | null,
    sourceDocumentId?: string | null
  ): string | undefined {
    if (!sourceType || !sourceNumber) return undefined;
    const base = `${companyId}|${sourceType}|${sourceNumber}|${sourceYearId ?? ''}`;
    const docId = sourceDocumentId?.trim();
    return docId ? `${base}|${docId}` : base;
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
    headerRate: number,
    headerCurrencyCode?: string
  ) {
    return lines.map((line) => {
      const rate = new Decimal(lineFxRate(headerCurrencyCode, line, headerRate));
      const debit = toDecimal4(line.debit);
      const credit = toDecimal4(line.credit);
      const lineCurrency = String(line.currencyCode || '').trim().toUpperCase() || null;
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
        currencyCode: lineCurrency,
        lineOrder: line.lineOrder,
        partnerId: line.partnerId,
        partnerType: line.partnerType,
        isTiedToInvoice: Boolean(line.isTiedToInvoice),
        invoiceId: line.invoiceId || null,
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
        sourceNumber: null,
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
    const saveUnbalanced =
      isOpeningBalanceDraft(data) ||
      (await companySettingService.getFlag(ctx.companyId, 'SaveUnbalanced', false));
    await hydrateEntryFx(ctx.companyId, data);
    const headerRate = persistFxRate(data.currencyCode, data.exchangeRate);
    const lineInputs = data.lines.map((l) => ({
      debit: l.debit,
      credit: l.credit,
      exchangeRate: lineFxRate(data.currencyCode, l, headerRate),
    }));
    const { isBalanced } = this.validateDoubleEntryBalance(lineInputs, {
      allowUnbalanced: saveUnbalanced,
    });

    const isOpening = isCompanyOpeningEntry({
      entryType: data.entryType,
      sourceType: data.sourceType,
    });
    const fiscalYearIdFromDate = await fiscalYearService.assertOpenForDate(
      ctx.companyId,
      data.date,
      {
        allowOpeningDocument: allowsOpeningDocumentDate({
          entryType: data.entryType,
          sourceType: data.sourceType,
        }),
      }
    );
    if (ctx.fiscalYearId && ctx.fiscalYearId !== fiscalYearIdFromDate && !isOpening) {
      throw new AppError(
        422,
        'تاريخ القيد خارج السنة المالية المختارة أعلى الشاشة. غيّر التاريخ أو اختر السنة الصحيحة ثم أعد الحفظ.'
      );
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
        branchId: optionalBranchId(ctx.branchId) ?? '',
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

    let entry;
    try {
      entry = await prisma.$transaction(async (tx) => {
      if (isOpening) await assertSingleOpeningJournal(tx, ctx.companyId);
      const created = await tx.journalEntry.create({
        data: {
          companyId: ctx.companyId,
          branchId: optionalBranchId(ctx.branchId),
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
          activeSourceKey: isOpening ? openingJournalSlotKey(ctx.companyId) : undefined,
        },
      });

      await tx.journalEntryLine.createMany({
        data: this.buildLineRows(created.id, lines, headerRate, data.currencyCode),
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String((error.meta as { target?: unknown } | undefined)?.target ?? '').includes(
          'activeSourceKey'
        )
      ) {
        throw new AppError(409, OPENING_JOURNAL_EXISTS_MESSAGE);
      }
      throw error;
    }

    if (data.isCyclic) {
      const synced = await this.syncCyclicRecurringTemplate(ctx.companyId, entry!.id, {
        sourceId: data.sourceId ?? entry?.sourceId,
        description: data.description,
        voucherNumber: data.voucherNumber ?? entry?.voucherNumber,
        date: data.date,
        lines,
      });
      return synced;
    }
    if (sourceKind === JournalSourceType.RECURRING_TEMPLATE && data.sourceId) {
      await recurringEntriesService.markGenerated(ctx.companyId, data.sourceId);
    }

    logger.info(
      { companyId: ctx.companyId, journalEntryId: entry!.id, legacyGlNum },
      'Journal entry created (posting service)'
    );

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
      reversalOfJournalEntryId?: string;
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
      /**
       * Invoice posting defers the customer/supplier/safe card update until
       * after cash settlement, so the safe row is locked before the party row.
       */
      skipCardColumns?: boolean;
    }
  ) {
    const glPost = await companySettingService.getFlag(ctx.companyId, 'GLPost', true);
    if (!glPost) {
      throw new AppError(403, 'ترحيل القيود مقفول لهذه الشركة');
    }

    // M2/M3 fix: this is the single GL entry point used by invoices, treasury,
    // payroll, POS, contracting, etc. — it previously skipped the fiscal
    // year/period lock entirely (the open-year guard only ran for manual GL
    // entries via createJournalEntry). Every document-driven posting must be
    // rejected once its *document date* falls in a closed year or period.
    const fiscalYearIdFromDate = await fiscalYearService.assertOpenForDate(ctx.companyId, data.date, {
      allowOpeningDocument: allowsOpeningDocumentDate({
        entryType: data.entryType,
        sourceType: data.sourceType,
      }),
    });

    await hydrateEntryFx(ctx.companyId, data);
    const headerRate = persistFxRate(data.currencyCode, data.exchangeRate);
    const lineInputs = data.lines.map((l) => ({
      debit: l.debit,
      credit: l.credit,
      exchangeRate: lineFxRate(data.currencyCode, l, headerRate),
    }));
    validateJournalLineSides(lineInputs);
    const { isBalanced } = this.validateDoubleEntryBalance(lineInputs, {
      allowUnbalanced: false,
      requireStrictLines: false,
    });
    if (!data.skipBalanceApply) {
      data.lines = await glAccountResolver.enforceCostCenters(tx, ctx.companyId, data.lines);
    }

    const requestedNumber = data.voucherNumber?.trim() || undefined;
    const existingLegacy = data.legacyGlNum?.trim() || undefined;
    const fiscalYearId = data.fiscalYearId?.trim() || fiscalYearIdFromDate;
    const legacyGlNum =
      existingLegacy ||
      (await documentSequenceService.nextGlNumberInTx(
        tx,
        {
          companyId: ctx.companyId,
          branchId: optionalBranchId(ctx.branchId) ?? '',
          fiscalYearId,
        },
        requestedNumber,
        { forceAutomatic: !requestedNumber }
      ));
    const voucherNumber = requestedNumber || legacyGlNum;
    const sourceKind = resolveJournalSourceKind(data.sourceType, data.sourceKind);
    const sourceType = persistJournalSourceType(data.sourceType, sourceKind);
    const companyOpening = isCompanyOpeningEntry({
      entryType: data.entryType,
      sourceType: data.sourceType ?? sourceType,
    });
    if (companyOpening) await assertSingleOpeningJournal(tx, ctx.companyId);

    const created = await tx.journalEntry.create({
      data: {
        companyId: ctx.companyId,
        branchId: optionalBranchId(ctx.branchId),
        fiscalYearId,
        legacyGlNum,
        voucherNumber,
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
        sourceType,
        sourceNumber: data.sourceNumber,
        sourceYearId: data.sourceYearId,
        sourceId: data.sourceId,
        sourceKind,
        activeSourceKey:
          data.claimActiveSourceKey === false
            ? undefined
            : companyOpening
              ? openingJournalSlotKey(ctx.companyId)
              : this.buildActiveSourceKey(
                ctx.companyId,
                sourceType,
                data.sourceNumber,
                data.sourceYearId,
                data.sourceId
              ),
        postedAt: new Date(),
        postedBy: ctx.userId,
        createdBy: ctx.userId,
        reversalOfJournalEntryId: data.reversalOfJournalEntryId ?? undefined,
      },
    });

    const postedLines = this.buildLineRows(created.id, data.lines, headerRate, data.currencyCode);
    await tx.journalEntryLine.createMany({
      data: postedLines,
    });

    if (!data.skipBalanceApply) {
      await applyPostedJournalBalancesInTx(tx, {
        companyId: ctx.companyId,
        date: data.date,
        currencyCode: data.currencyCode,
        skipCardColumns: data.skipCardColumns,
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
   * Unpost in place: invert period/partner/card balances on the same journal
   * and clear its posted flag. Never books a second "قيد عكسي" row.
   * A historical reversal (from the old contra-entry path) is left alone so
   * balances are not inverted twice.
   */
  async reverseJournalEntryInTx(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext,
    journalEntryId: string,
    _opts?: { date?: Date; reason?: string; skipCardColumns?: boolean }
  ) {
    const original = await tx.journalEntry.findFirst({
      where: { id: journalEntryId, companyId: ctx.companyId },
      include: this.journalInclude(),
    });
    if (!original) {
      throw new AppError(404, 'القيد غير موجود');
    }
    if (original.deletedAt) {
      throw new AppError(400, 'القيد محذوف');
    }

    const existingReversal = await tx.journalEntry.findFirst({
      where: { reversalOfJournalEntryId: original.id },
      include: this.journalInclude(),
    });
    if (existingReversal) {
      return { original, reversal: existingReversal };
    }

    const posted = Boolean(original.isPosted || original.postingStatus === 'Post');
    if (!posted) {
      return { original, reversal: original };
    }

    const unposted = await this.unpostSourceJournalInTx(tx, ctx, journalEntryId, {
      skipCardColumns: _opts?.skipCardColumns,
    });
    const next = unposted
      ? await tx.journalEntry.findFirst({
          where: { id: journalEntryId, companyId: ctx.companyId },
          include: this.journalInclude(),
        })
      : original;

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

    return { original: next ?? original, reversal: next ?? original };
  }

  /**
   * Books a new dated contra journal that mirrors a posted source JE (original
   * stays posted). Used by canonical contracting certificate financial reversal.
   */
  async createDatedContraReversalJournalInTx(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext,
    params: {
      originalJournalEntryId: string;
      reversalDate: Date;
      reason?: string;
      sourceType?: string;
      sourceNumber?: string;
      description?: string;
    }
  ): Promise<{ original: { id: string }; reversal: { id: string }; replay: boolean }> {
    const original = await tx.journalEntry.findFirst({
      where: { id: params.originalJournalEntryId, companyId: ctx.companyId, deletedAt: null },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!original) {
      throw new AppError(404, 'القيد غير موجود');
    }
    const posted = Boolean(original.isPosted || original.postingStatus === 'Post');
    if (!posted) {
      throw new AppError(422, 'القيد الأصلي غير مرحّل');
    }

    const existing = await tx.journalEntry.findFirst({
      where: {
        reversalOfJournalEntryId: original.id,
        companyId: ctx.companyId,
        deletedAt: null,
        isCancelled: false,
      },
    });
    if (existing && (existing.isPosted || existing.postingStatus === 'Post')) {
      return { original: { id: original.id }, reversal: { id: existing.id }, replay: true };
    }

    const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, params.reversalDate);
    const legacyGlNum = await documentSequenceService.nextGlNumberInTx(tx, {
      companyId: ctx.companyId,
      branchId: ctx.branchId ?? '',
      fiscalYearId,
    });

    const mirroredLines: JournalEntryLineData[] = original.lines.map((line, idx) => ({
      accountId: line.accountId,
      debit: Number(line.credit),
      credit: Number(line.debit),
      exchangeRate: Number(line.exchangeRate),
      currencyCode: line.currencyCode,
      costCenterId: line.costCenterId,
      description: line.description ?? line.descriptionAr ?? undefined,
      partnerId: line.partnerId,
      partnerType: line.partnerType as JournalEntryLineData['partnerType'],
      lineOrder: idx + 1,
    }));

    const reversal = await this.createAndPostInTx(tx, { ...ctx, fiscalYearId }, {
      fiscalYearId,
      legacyGlNum,
      date: params.reversalDate,
      description:
        params.description ??
        `عكس قيد: ${original.description ?? original.voucherNumber ?? original.id}${
          params.reason ? ` — ${params.reason}` : ''
        }`,
      currencyCode: original.currencyCode,
      exchangeRate: Number(original.exchangeRate),
      entryType: 'REVERSAL',
      sourceType: params.sourceType ?? original.sourceType ?? undefined,
      sourceNumber: params.sourceNumber ?? original.sourceNumber ?? undefined,
      sourceYearId: original.sourceYearId ?? undefined,
      claimActiveSourceKey: false,
      reversalOfJournalEntryId: original.id,
      lines: mirroredLines,
    });

    return { original: { id: original.id }, reversal: { id: reversal.id }, replay: false };
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

  /**
   * Rewrite a posted journal in place. Used when the source document is
   * edited — the same voucher number / id keeps the new lines instead of
   * booking a reversal plus a second entry.
   */
  async replacePostedJournalInTx(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext,
    journalEntryId: string,
    data: {
      date: Date;
      hijriDate?: string | null;
      description?: string | null;
      currencyCode: string;
      exchangeRate?: number | null;
      sourceNumber?: string | null;
      lines: JournalEntryLineData[];
    },
    balanceOpts?: { skipCardColumns?: boolean }
  ) {
    const original = await tx.journalEntry.findFirst({
      where: { id: journalEntryId, companyId: ctx.companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!original) {
      throw new AppError(404, 'القيد غير موجود');
    }
    if (original.deletedAt) {
      throw new AppError(400, 'القيد محذوف');
    }
    if (original.isCancelled) {
      throw new AppError(400, 'القيد ملغي ولا يمكن تعديله');
    }

    const wasPosted = Boolean(original.isPosted || original.postingStatus === 'Post');
    await fiscalYearService.assertOpenForDate(ctx.companyId, data.date, {
      allowOpeningDocument: allowsOpeningDocumentDate(original),
    });

    await hydrateEntryFx(ctx.companyId, data);
    const headerRate = persistFxRate(data.currencyCode, data.exchangeRate);
    const resolvedLines = await glAccountResolver.enforceCostCenters(
      tx,
      ctx.companyId,
      data.lines
    );
    const lineInputs = resolvedLines.map((line) => ({
      debit: line.debit,
      credit: line.credit,
      exchangeRate: lineFxRate(data.currencyCode, line, headerRate),
    }));
    validateJournalLineSides(lineInputs);
    this.validateDoubleEntryBalance(lineInputs, { allowUnbalanced: false, requireStrictLines: false });

    if (wasPosted) {
      await applyPostedJournalBalancesInTx(tx, {
        companyId: ctx.companyId,
        date: original.date,
        currencyCode: original.currencyCode,
        invert: true,
        skipCardColumns: balanceOpts?.skipCardColumns,
        lines: original.lines,
      });
    }

    await tx.journalEntry.update({
      where: { id: journalEntryId },
      data: {
        date: data.date,
        hijriDate: resolveHijriDate(data.date, data.hijriDate ?? original.hijriDate),
        description: data.description ?? original.description,
        currencyCode: data.currencyCode,
        exchangeRate: new Decimal(headerRate),
        sourceNumber: data.sourceNumber ?? original.sourceNumber,
        version: { increment: 1 },
      },
    });
    await tx.journalEntryLine.deleteMany({ where: { journalEntryId } });
    await tx.journalEntryLine.createMany({
      data: this.buildLineRows(journalEntryId, resolvedLines, headerRate, data.currencyCode),
    });

    const nextLines = await tx.journalEntryLine.findMany({
      where: { journalEntryId },
      orderBy: { lineOrder: 'asc' },
    });
    if (wasPosted) {
      await applyPostedJournalBalancesInTx(tx, {
        companyId: ctx.companyId,
        date: data.date,
        currencyCode: data.currencyCode,
        skipCardColumns: balanceOpts?.skipCardColumns,
        lines: nextLines,
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
  }

  /**
   * Edit/repost on the same journal id. Cancels a leftover historical
   * contra row after unwinding its caches so a second "قيد عكسي" is never booked.
   */
  async reuseSourceJournalInTx(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext,
    journalEntryId: string,
    data: {
      date: Date;
      hijriDate?: string | null;
      description?: string | null;
      currencyCode: string;
      exchangeRate?: number | null;
      sourceNumber?: string | null;
      lines: JournalEntryLineData[];
      activeSourceKey?: string | null;
    },
    balanceOpts?: { skipCardColumns?: boolean }
  ) {
    const reversal = await tx.journalEntry.findFirst({
      where: { reversalOfJournalEntryId: journalEntryId, deletedAt: null },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (reversal) {
      const reversalPosted =
        !reversal.isCancelled && Boolean(reversal.isPosted || reversal.postingStatus === 'Post');
      if (reversalPosted) {
        await applyPostedJournalBalancesInTx(tx, {
          companyId: ctx.companyId,
          date: reversal.date,
          currencyCode: reversal.currencyCode,
          invert: true,
          lines: reversal.lines,
        });
      }
      await tx.journalEntry.update({
        where: { id: reversal.id },
        data: {
          isCancelled: true,
          isPosted: false,
          postingStatus: 'UnPost',
          activeSourceKey: null,
          deletedAt: new Date(),
        },
      });
    }

    await this.replacePostedJournalInTx(
      tx,
      ctx,
      journalEntryId,
      {
        date: data.date,
        hijriDate: data.hijriDate,
        description: data.description,
        currencyCode: data.currencyCode,
        exchangeRate: data.exchangeRate,
        sourceNumber: data.sourceNumber,
        lines: data.lines,
      },
      balanceOpts
    );

    const reposted = await this.repostSourceJournalInTx(
      tx,
      ctx,
      journalEntryId,
      data.activeSourceKey,
      balanceOpts
    );
    return reposted;
  }

  /**
   * Unpost a source-document journal without a contra entry, so the same
   * voucher stays on the paper and can be posted again.
   */
  async unpostSourceJournalInTx(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext,
    journalEntryId: string,
    balanceOpts?: { skipCardColumns?: boolean }
  ) {
    const entry = await tx.journalEntry.findFirst({
      where: { id: journalEntryId, companyId: ctx.companyId, deletedAt: null },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!entry || entry.isCancelled) return null;
    if (entry.entryType === 'REVERSAL') return null;
    const posted = Boolean(entry.isPosted || entry.postingStatus === 'Post');
    if (!posted) return entry;

    await applyPostedJournalBalancesInTx(tx, {
      companyId: ctx.companyId,
      date: entry.date,
      currencyCode: entry.currencyCode,
      invert: true,
      skipCardColumns: balanceOpts?.skipCardColumns,
      lines: entry.lines,
    });
    return tx.journalEntry.update({
      where: { id: journalEntryId },
      data: {
        isPosted: false,
        postingStatus: 'UnPost',
        postedAt: null,
        postedBy: null,
        activeSourceKey: null,
        version: { increment: 1 },
      },
    });
  }

  /** Post the same source journal again after an in-place unpost. */
  async repostSourceJournalInTx(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext,
    journalEntryId: string,
    activeSourceKey?: string | null,
    balanceOpts?: { skipCardColumns?: boolean }
  ) {
    const entry = await tx.journalEntry.findFirst({
      where: { id: journalEntryId, companyId: ctx.companyId, deletedAt: null },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!entry || entry.isCancelled) {
      throw new AppError(400, 'قيد الورقة غير موجود');
    }
    if (entry.isPosted || entry.postingStatus === 'Post') return entry;

    const { count } = await tx.journalEntry.updateMany({
      where: { id: journalEntryId, companyId: ctx.companyId, isPosted: false },
      data: {
        isPosted: true,
        postingStatus: 'Post',
        postedAt: new Date(),
        postedBy: ctx.userId,
        activeSourceKey: activeSourceKey ?? entry.activeSourceKey,
      },
    });
    if (count === 0) return entry;

    await applyPostedJournalBalancesInTx(tx, {
      companyId: ctx.companyId,
      date: entry.date,
      currencyCode: entry.currencyCode,
      skipCardColumns: balanceOpts?.skipCardColumns,
      lines: entry.lines,
    });
    return tx.journalEntry.findFirst({ where: { id: journalEntryId } });
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
      throw new AppError(404, 'القيد غير موجود');
    }
    if (existing.deletedAt) {
      throw new AppError(400, 'القيد محذوف');
    }
    if (existing.postingStatus === 'Post' || existing.isPosted) {
      throw new AppError(
        400,
        'القيد مرحّل ولا يمكن تعديله. فك الترحيل أولاً من قائمة (...).'
      );
    }
    if (isSourcedJournalEntry(existing)) {
      throw new AppError(422, SOURCED_JOURNAL_MUTATION_MESSAGE);
    }
    if (existing.isCancelled && existing.entryType !== 'OPENING_BALANCE') {
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
    const isOpeningUpdate = allowsOpeningDocumentDate({
      entryType: data.entryType ?? existing.entryType,
      sourceType: existing.sourceType,
    });
    await fiscalYearService.assertOpenForDate(ctx.companyId, entryDate, {
      allowOpeningDocument: isOpeningUpdate,
    });

    const saveUnbalanced =
      isOpeningBalanceDraft({
        saveAsDraft: data.saveAsDraft,
        entryType: data.entryType ?? existing.entryType,
      }) ||
      (await companySettingService.getFlag(ctx.companyId, 'SaveUnbalanced', false));
    const hydrated = await hydrateEntryFx(ctx.companyId, {
      currencyCode: data.currencyCode ?? existing.currencyCode,
      exchangeRate: data.exchangeRate ?? Number(existing.exchangeRate ?? 1),
      lines: data.lines,
    });
    data.exchangeRate = hydrated.exchangeRate ?? data.exchangeRate;
    const headerRate = persistFxRate(
      data.currencyCode ?? existing.currencyCode,
      data.exchangeRate ?? existing.exchangeRate
    );

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
          exchangeRate: lineFxRate(
            data.currencyCode ?? existing.currencyCode,
            l,
            headerRate
          ),
        })),
        { allowUnbalanced: saveUnbalanced }
      );
    }

    const wasOpening = isCompanyOpeningEntry(existing);
    const willBeOpening = isCompanyOpeningEntry({
      entryType: data.entryType ?? existing.entryType,
      sourceType: data.sourceType ?? existing.sourceType,
    });

    const updated = await prisma.$transaction(async (tx) => {
      if (willBeOpening && !wasOpening) {
        await assertSingleOpeningJournal(tx, ctx.companyId, journalEntryId);
      }
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
      if (willBeOpening && !wasOpening) {
        updateData.activeSourceKey = openingJournalSlotKey(ctx.companyId);
      }
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
            exchangeRate: lineFxRate(
            data.currencyCode ?? existing.currencyCode,
            l,
            headerRate
          ),
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
          data: this.buildLineRows(
            journalEntryId,
            data.lines,
            headerRate,
            data.currencyCode ?? existing.currencyCode
          ),
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

    return synced;
  }

  async postJournalEntry(ctx: JournalPostingContext, journalEntryId: string) {
    const glPost = await companySettingService.getFlag(ctx.companyId, 'GLPost', true);
    if (!glPost) {
      throw new AppError(403, 'ترحيل القيود مقفول لهذه الشركة');
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
        throw new AppError(404, 'القيد غير موجود');
      }
      if (entry.deletedAt) {
        throw new AppError(400, 'القيد محذوف');
      }
      if (entry.branchId && ctx.branchId && entry.branchId !== ctx.branchId) {
        throw new AppError(403, 'القيد يتبع فرعاً آخر. غيّر الفرع ثم أعد الترحيل.');
      }
      if (entry.postingStatus === 'Post' || entry.isPosted) {
        throw new AppError(400, 'القيد مرحّل مسبقاً');
      }
      const documentStatus = (entry.documentStatus ?? 'Open').trim().toLowerCase();
      if (documentStatus && documentStatus !== 'open') {
        throw new AppError(400, 'مستند القيد غير مفتوح للترحيل');
      }
      if (!entry.isBalanced) {
        throw new AppError(422, 'لا يمكن ترحيل قيد غير متزن. ساوِ إجمالي المدين مع إجمالي الدائن ثم أعد الحفظ.');
      }
      if (isSourcedJournalEntry(entry)) {
        throw new AppError(422, SOURCED_JOURNAL_MUTATION_MESSAGE);
      }
      if (entry.isCancelled) {
        throw new AppError(400, 'لا يمكن ترحيل قيد ملغي');
      }

      await fiscalYearService.assertOpenForDate(ctx.companyId, entry.date, {
        allowOpeningDocument: allowsOpeningDocumentDate(entry),
      });

      const { debitBase, creditBase } = this.computeBaseTotals(
        entry.lines.map((l) => ({
          debit: Number(l.debit),
          credit: Number(l.credit),
          exchangeRate: Number(l.exchangeRate),
        }))
      );
      if (!amountsEqualAt4(debitBase, creditBase)) {
        throw new AppError(422, 'لا يمكن ترحيل قيد غير متزن. ساوِ إجمالي المدين مع إجمالي الدائن ثم أعد الحفظ.');
      }

      // Wave 4 fix: the findFirst above is a plain read, so two concurrent
      // postJournalEntry calls for the same entry can both pass the
      // "not already posted" check before either writes. Guard the write
      // itself with a conditional updateMany keyed on the still-unposted
      // state; MySQL's row lock on the matched row means only one
      // concurrent transaction can win the race, and the loser sees
      // count === 0 and fails instead of double-posting.
      const { count } = await tx.journalEntry.updateMany({
        where: {
          id: journalEntryId,
          companyId: ctx.companyId,
          isPosted: false,
          postingStatus: { not: 'Post' },
        },
        data: {
          isPosted: true,
          postingStatus: 'Post',
          workflowStatus: 'POSTED',
          postedAt: new Date(),
          postedBy: ctx.userId,
        },
      });
      if (count === 0) {
        throw new AppError(409, 'تم ترحيل القيد من عملية أخرى في نفس اللحظة. حدّث الصفحة.');
      }

      try {
        await applyPostedJournalBalancesInTx(tx, {
          companyId: ctx.companyId,
          date: entry.date,
          currencyCode: entry.currencyCode,
          lines: entry.lines,
        });
      } catch (error) {
        if (error instanceof AppError) throw error;
        const prismaCode =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';
        if (prismaCode === 'P2003') {
          throw new AppError(
            409,
            'تعذّر الترحيل لأن حساباً في القيد غير موجود. راجع الحسابات ثم احفظ القيد من جديد.'
          );
        }
        logger.error({ error, journalEntryId }, 'Failed to apply posted journal balances');
        throw new AppError(
          500,
          'تعذّر تحديث أرصدة الحسابات أثناء الترحيل. حدّث الصفحة ثم أعد المحاولة.',
          false
        );
      }

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

      if (isSourcedJournalEntry(entry)) {
        throw new AppError(422, SOURCED_JOURNAL_MUTATION_MESSAGE);
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
        allowOpeningDocument: allowsOpeningDocumentDate(entry),
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
          activeSourceKey:
            String(entry.entryType ?? '').toUpperCase() === 'OPENING_BALANCE'
              ? entry.activeSourceKey
              : null,
          version: { increment: 1 },
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

  /**
   * Source documents own their generated JE. Unpost/cancel on the source
   * must move the linked journal to the same state.
   */
  async cascadeSourceJournalInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    journalEntryIds: Array<string | null | undefined>,
    action: 'unpost' | 'cancel',
    userId?: string,
    lookup?: { sourceId?: string; sourceType?: string; sourceNumber?: string },
    balanceOpts?: { skipCardColumns?: boolean }
  ) {
    const ids = new Set(journalEntryIds.filter((id): id is string => Boolean(id)));
    if (lookup?.sourceId) {
      const bySourceId = await tx.journalEntry.findMany({
        where: { companyId, sourceId: lookup.sourceId, deletedAt: null, entryType: { not: 'REVERSAL' } },
        select: { id: true },
      });
      for (const row of bySourceId) ids.add(row.id);
    }
    if (lookup?.sourceType && lookup.sourceNumber) {
      const bySource = await tx.journalEntry.findMany({
        where: {
          companyId,
          sourceType: lookup.sourceType,
          sourceNumber: lookup.sourceNumber,
          deletedAt: null,
          entryType: { not: 'REVERSAL' },
        },
        select: { id: true },
      });
      for (const row of bySource) ids.add(row.id);
    }
    for (const journalEntryId of ids) {
      const entry = await tx.journalEntry.findFirst({
        where: { id: journalEntryId, companyId },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
      if (!entry || entry.deletedAt) continue;
      if (action === 'cancel' && entry.isCancelled && !entry.isPosted) continue;
      if (action === 'unpost' && !entry.isPosted && entry.postingStatus !== 'Post') continue;

      const reversal = await tx.journalEntry.findFirst({
        where: { reversalOfJournalEntryId: entry.id, deletedAt: null },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
      if (reversal) {
        const reversalPosted =
          !reversal.isCancelled && Boolean(reversal.isPosted || reversal.postingStatus === 'Post');
        if (reversalPosted) {
          await applyPostedJournalBalancesInTx(tx, {
            companyId,
            date: reversal.date,
            currencyCode: reversal.currencyCode,
            invert: true,
            lines: reversal.lines,
          });
        }
        await tx.journalEntry.update({
          where: { id: reversal.id },
          data: {
            isCancelled: true,
            isPosted: false,
            postingStatus: 'UnPost',
            activeSourceKey: null,
            deletedAt: new Date(),
          },
        });
      }

      const posted = entry.isPosted || entry.postingStatus === 'Post';
      if (posted) {
        await this.unpostSourceJournalInTx(
          tx,
          {
            companyId,
            branchId: entry.branchId,
            fiscalYearId: entry.fiscalYearId ?? undefined,
            userId: userId ?? AUTOMATION_SYSTEM_ACTOR_ID,
          },
          journalEntryId,
          balanceOpts
        );
        if (action === 'cancel') {
          await tx.journalEntry.update({
            where: { id: journalEntryId },
            data: { isCancelled: true },
          });
        }
        await documentAuditService.record(
          {
            companyId,
            entityType: 'JOURNAL_ENTRY',
            entityId: journalEntryId,
            action: action === 'cancel' ? 'CANCELLED' : 'UNPOSTED',
            userId: userId ?? AUTOMATION_SYSTEM_ACTOR_ID,
          },
          tx
        );
        continue;
      }

      await tx.journalEntry.update({
        where: { id: journalEntryId },
        data: action === 'cancel' ? { isCancelled: true } : {},
      });

      await documentAuditService.record(
        {
          companyId,
          entityType: 'JOURNAL_ENTRY',
          entityId: journalEntryId,
          action: action === 'cancel' ? 'CANCELLED' : 'UNPOSTED',
          // userId may be undefined when called from background workers; fall back to system actor
          userId: userId ?? AUTOMATION_SYSTEM_ACTOR_ID,
        },
        tx
      );
    }
  }
}

export const journalPostingService = new JournalPostingService();
