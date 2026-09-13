import { randomBytes } from 'node:crypto';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { advancedRightsService } from '../../platform/services/advanced-rights.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { tradeAccountResolverService } from './trade-account-resolver.service';
import { journalLines } from '../utils/journal-lines.util';

export type GuaranteeLetterType = 'BID_BOND' | 'PERFORMANCE' | 'ADVANCE_PAYMENT';

export interface IssueGuaranteeLetterInput {
  lgNumber: string;
  lgType: GuaranteeLetterType;
  bankAccountId: string;
  beneficiaryName?: string;
  amount: number;
  cashCoverAmount: number;
  commissionAmount: number;
  currencyCode?: string;
  issueDate: Date;
  expiryDate?: Date;
  sourceYearId?: string;
}

export class LetterOfGuaranteeService {
  /**
   * `journalEntry.sourceNumber` is `@db.VarChar(30)`, so a fresh short random token (rather
   * than the LG number, which is user-provided and can be arbitrarily long) is used to keep
   * each lifecycle event's `activeSourceKey` slot distinct — see the note in `issue()`.
   */
  private eventSourceNumber(tag: string): string {
    return `${tag}:${randomBytes(6).toString('hex')}`;
  }

  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  /** Legacy `ETPost`/`ETUnPost` — see `letter-of-credit.service.ts` for the mapping. */
  private async assertEtemadRight(
    ctx: JournalPostingContext,
    mode: 'post' | 'unpost'
  ): Promise<void> {
    await advancedRightsService.assertCanPostFamily(
      ctx.companyId,
      ctx.userId,
      ctx.branchId,
      mode === 'post' ? 'etPost' : 'etUnpost',
      { isAdmin: ctx.isAdmin, actionLabel: `${mode} letters of guarantee` }
    );
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.guaranteeLetter.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new AppError(404, 'Guarantee letter not found');
    return row;
  }

  async issue(ctx: JournalPostingContext, input: IssueGuaranteeLetterInput) {
    await this.assertEtemadRight(ctx, 'post');
    const accounts = await tradeAccountResolverService.resolveTradeAccounts(ctx.companyId);
    const bankGlId = await treasuryAccountResolverService.resolveBankGlAccountId(
      ctx.companyId,
      input.bankAccountId
    );

    const cover = roundTo4(input.cashCoverAmount);
    const commission = roundTo4(input.commissionAmount);
    const bankCredit = roundTo4(cover + commission);
    if (bankCredit <= 0) {
      throw new AppError(422, 'Cash cover or commission must be greater than zero');
    }

    const legacyGlNum = await this.allocateGlNum(ctx);

    return prisma.$transaction(async (tx) => {
      const lines = journalLines([
        ...(cover > 0
          ? [{ accountId: accounts.lgCashCoverAccountId, debit: cover, credit: 0 }]
          : []),
        ...(commission > 0
          ? [{ accountId: accounts.bankCommissionAccountId, debit: commission, credit: 0 }]
          : []),
        { accountId: bankGlId, debit: 0, credit: bankCredit },
      ]);

      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: input.issueDate,
        description: `Issue LG ${input.lgNumber} (${input.lgType})`,
        currencyCode: input.currencyCode ?? 'EGP',
        exchangeRate: 1,
        entryType: 'LGIssue',
        sourceType: 'LG',
        // M14/Phase1 fix: an LG posts a distinct, concurrently-active JE at issue and again
        // at release/confiscate. activeSourceKey has no entryType component, so reusing the
        // bare LG number for both collided on the unique constraint the moment the second
        // event posted (see the matching note in letter-of-credit.service.ts). The LG
        // number/description already give full traceability.
        sourceNumber: this.eventSourceNumber('LGI'),
        sourceYearId: input.sourceYearId,
        lines,
      });

      return tx.guaranteeLetter.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          fiscalYearId: ctx.fiscalYearId,
          sourceYearId: input.sourceYearId,
          lgNumber: input.lgNumber,
          lgType: input.lgType,
          bankAccountId: input.bankAccountId,
          beneficiaryName: input.beneficiaryName,
          amount: new Decimal(input.amount),
          cashCoverAmount: new Decimal(cover),
          commissionAmount: new Decimal(commission),
          currencyCode: input.currencyCode ?? 'EGP',
          issueDate: input.issueDate,
          expiryDate: input.expiryDate,
          status: 'ACTIVE',
          issueJournalEntryId: je.id,
        },
      });
    });
  }

  async extend(ctx: JournalPostingContext, id: string, newExpiryDate: Date) {
    const row = await this.getById(ctx.companyId, id);
    if (row.status === 'RELEASED' || row.status === 'CONFISCATED') {
      throw new AppError(400, 'Cannot extend a closed guarantee letter');
    }
    return prisma.guaranteeLetter.update({
      where: { id },
      data: {
        status: 'EXTENDED',
        expiryDate: newExpiryDate,
        extendedAt: new Date(),
      },
    });
  }

  async release(ctx: JournalPostingContext, id: string) {
    await this.assertEtemadRight(ctx, 'post');
    const row = await this.getById(ctx.companyId, id);
    if (row.status === 'RELEASED') {
      throw new AppError(400, 'Guarantee letter is already released');
    }
    if (row.status === 'CONFISCATED') {
      throw new AppError(400, 'Confiscated guarantee cannot be released');
    }
    if (!row.bankAccountId) {
      throw new AppError(422, 'Bank account is required to release cover');
    }

    const cover = roundTo4(Number(row.cashCoverAmount));
    if (cover <= 0) {
      throw new AppError(422, 'No cash cover to release');
    }

    const accounts = await tradeAccountResolverService.resolveTradeAccounts(ctx.companyId);
    const bankGlId = await treasuryAccountResolverService.resolveBankGlAccountId(
      ctx.companyId,
      row.bankAccountId
    );
    const legacyGlNum = await this.allocateGlNum(ctx);
    const releaseDate = new Date();

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: releaseDate,
        description: `Release LG ${row.lgNumber}`,
        currencyCode: row.currencyCode,
        exchangeRate: 1,
        entryType: 'LGRelease',
        sourceType: 'LG',
        sourceNumber: this.eventSourceNumber('LGR'),
        sourceYearId: row.sourceYearId ?? undefined,
        lines: journalLines([
          { accountId: bankGlId, debit: cover, credit: 0 },
          { accountId: accounts.lgCashCoverAccountId, debit: 0, credit: cover },
        ]),
      });

      return tx.guaranteeLetter.update({
        where: { id },
        data: {
          status: 'RELEASED',
          releaseJournalEntryId: je.id,
          releasedAt: releaseDate,
        },
      });
    });
  }

  async confiscate(ctx: JournalPostingContext, id: string) {
    await this.assertEtemadRight(ctx, 'post');
    const row = await this.getById(ctx.companyId, id);
    if (row.status === 'RELEASED' || row.status === 'CONFISCATED') {
      throw new AppError(400, 'Guarantee letter is already closed');
    }

    const cover = roundTo4(Number(row.cashCoverAmount));
    if (cover <= 0) {
      throw new AppError(422, 'No cash cover to confiscate');
    }

    const accounts = await tradeAccountResolverService.resolveTradeAccounts(ctx.companyId);
    const legacyGlNum = await this.allocateGlNum(ctx);
    const confiscateDate = new Date();

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: confiscateDate,
        description: `Confiscate LG ${row.lgNumber}`,
        currencyCode: row.currencyCode,
        exchangeRate: 1,
        entryType: 'LGConfiscate',
        sourceType: 'LG',
        sourceNumber: this.eventSourceNumber('LGX'),
        sourceYearId: row.sourceYearId ?? undefined,
        lines: journalLines([
          { accountId: accounts.lgConfiscationLossAccountId, debit: cover, credit: 0 },
          { accountId: accounts.lgCashCoverAccountId, debit: 0, credit: cover },
        ]),
      });

      return tx.guaranteeLetter.update({
        where: { id },
        data: {
          status: 'CONFISCATED',
          confiscateJournalEntryId: je.id,
        },
      });
    });
  }

  /**
   * Wave 2 fix: reverses a RELEASED guarantee — dated contra entry against
   * the release JE, restoring cash cover and reopening the LG as ACTIVE.
   */
  async unrelease(ctx: JournalPostingContext, id: string) {
    await this.assertEtemadRight(ctx, 'unpost');
    const row = await this.getById(ctx.companyId, id);
    if (row.status !== 'RELEASED') {
      throw new AppError(400, 'Only a RELEASED guarantee letter can be un-released');
    }
    if (!row.releaseJournalEntryId) {
      throw new AppError(400, 'Guarantee letter has no release journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, row.releaseJournalEntryId!, {
        reason: 'Guarantee letter release unposted',
      });

      return tx.guaranteeLetter.update({
        where: { id },
        data: { status: 'ACTIVE', releaseJournalEntryId: null, releasedAt: null },
      });
    });
  }

  /**
   * Wave 2 fix: reverses a CONFISCATED guarantee — dated contra entry
   * against the confiscation loss JE, restoring cash cover and reopening
   * the LG as ACTIVE.
   */
  async unconfiscate(ctx: JournalPostingContext, id: string) {
    await this.assertEtemadRight(ctx, 'unpost');
    const row = await this.getById(ctx.companyId, id);
    if (row.status !== 'CONFISCATED') {
      throw new AppError(400, 'Only a CONFISCATED guarantee letter can be reversed');
    }
    if (!row.confiscateJournalEntryId) {
      throw new AppError(400, 'Guarantee letter has no confiscation journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, row.confiscateJournalEntryId!, {
        reason: 'Guarantee letter confiscation unposted',
      });

      return tx.guaranteeLetter.update({
        where: { id },
        data: { status: 'ACTIVE', confiscateJournalEntryId: null },
      });
    });
  }
}

export const letterOfGuaranteeService = new LetterOfGuaranteeService();
