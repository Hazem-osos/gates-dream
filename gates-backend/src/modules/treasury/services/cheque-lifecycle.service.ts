import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, type ChequeDirection, type ChequeStatus } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { autoGlPostingService } from '../../accounting/services/auto-gl-posting.service';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';
import { companySettingService } from '../../platform/services/company-setting.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { advancedRightsService } from '../../platform/services/advanced-rights.service';
import { bankBoxRightsService } from './bank-box-rights.service';
import { treasuryAccountResolverService } from './treasury-account-resolver.service';
import type { TreasuryPostingContext } from '../types/treasury.types';
import { assertChequeTransition } from './cheque-transition.util';
import {
  resolveCompanyFxRate,
  toBaseAmount,
} from '../../accounting/utils/company-fx-rate';

const chequePartyInclude = {
  customer: { select: { id: true, code: true, arabicName: true } },
  supplier: { select: { id: true, code: true, arabicName: true } },
  endorsedSupplier: { select: { id: true, code: true, arabicName: true } },
  bankAccount: { select: { id: true, accountNumber: true, arabicName: true } },
} satisfies Prisma.ChequeInclude;

function serializeCheque<T extends { amount: Prisma.Decimal | number }>(row: T) {
  return { ...row, amount: Number(row.amount) };
}

export interface CreateInwardChequeInput {
  chequeNumber: string;
  bankName?: string;
  dueDate?: Date;
  amount: number;
  currencyCode: string;
  customerId: string;
  description?: string;
}

export interface CreateOutwardChequeInput {
  chequeNumber: string;
  bankName?: string;
  dueDate?: Date;
  amount: number;
  currencyCode: string;
  supplierId: string;
  bankAccountId?: string;
  description?: string;
}

export class ChequeLifecycleService {
  private async allocateGlNumInTx(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext
  ): Promise<string | undefined> {
    return documentSequenceService.nextGlNumberInTx(tx, ctx);
  }

  /**
   * Legacy `AdvancedRights` cheque families: `RCPost`/`RCUnPost` guard the
   * receive-cheque screen (`untRecieveCheck.pas`, inward) and
   * `PCPost`/`PCUnPost` the payment-cheque screen (`untPaymentCheck.pas`,
   * outward). Only the standalone entry points are guarded — the `*InTx`
   * variants run inside invoice posting, which legacy gates on the invoice's
   * own family instead, so double-guarding there would deny a tendered
   * invoice for a right the cashier never needed.
   */
  private async assertChequeRight(
    ctx: TreasuryPostingContext,
    direction: 'INWARD' | 'OUTWARD',
    mode: 'post' | 'unpost'
  ): Promise<void> {
    const family = direction === 'INWARD' ? 'rc' : 'pc';
    await advancedRightsService.assertCanPostFamily(
      ctx.companyId,
      ctx.userId,
      ctx.branchId,
      mode === 'post' ? `${family}Post` : `${family}Unpost`,
      {
        isAdmin: ctx.isAdmin,
        actionLabel: `${mode} ${direction === 'INWARD' ? 'received' : 'payment'} cheques`,
      }
    );
  }

  private async sourceYearId(ctx: TreasuryPostingContext): Promise<string> {
    const fy = await prisma.fiscalYear.findFirst({
      where: { id: ctx.fiscalYearId, companyId: ctx.companyId },
      select: { legacyYearId: true },
    });
    return fy?.legacyYearId ?? String(new Date().getUTCFullYear());
  }

  private async chequeFx(companyId: string, currencyCode?: string | null) {
    return resolveCompanyFxRate(companyId, currencyCode);
  }

  private chequeBase(amount: number, exchangeRate: number) {
    return new Decimal(toBaseAmount(amount, exchangeRate));
  }

  private async postJe(
    tx: Prisma.TransactionClient,
    ctx: TreasuryPostingContext,
    params: {
      date: Date;
      description: string;
      currencyCode: string;
      exchangeRate?: number;
      sourceType: string;
      sourceNumber: string;
      sourceYearId: string;
      sourceId?: string;
      lines: JournalEntryLineData[];
    }
  ) {
    const exchangeRate =
      params.exchangeRate ?? (await this.chequeFx(ctx.companyId, params.currencyCode)).exchangeRate;
    const legacyGlNum = await this.allocateGlNumInTx(tx, ctx);
    const je = await autoGlPostingService.commitInTx(tx, ctx, {
      fiscalYearId: ctx.fiscalYearId!,
      legacyGlNum,
      date: params.date,
      description: params.description,
      currencyCode: params.currencyCode,
      exchangeRate,
      entryType: 'Cheque',
      sourceType: params.sourceType,
      sourceId: params.sourceId ?? params.sourceNumber,
      sourceNumber: params.sourceNumber,
      sourceYearId: params.sourceYearId,
      lines: params.lines,
    });
    if (!je) {
      throw new AppError(422, 'Cheque GL posting was skipped');
    }
    return je;
  }

  async createInwardChequeInTx(
    tx: Prisma.TransactionClient,
    ctx: TreasuryPostingContext,
    input: CreateInwardChequeInput,
    extra?: { invoiceId?: string }
  ) {
    const chequeAccounts = await treasuryAccountResolverService.resolveChequeAccounts(
      ctx.companyId
    );
    const customerAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
      companyId: ctx.companyId,
      customerId: input.customerId,
      invoiceId: extra?.invoiceId,
    });
    const amount = input.amount;
    const { exchangeRate } = await this.chequeFx(ctx.companyId, input.currencyCode);
    const sourceYearId = await this.sourceYearId(ctx);

    const lines: JournalEntryLineData[] = [
      {
        accountId: chequeAccounts.chequesUnderHandAccountId,
        debit: amount,
        credit: 0,
        lineOrder: 1,
      },
      { accountId: customerAccountId, debit: 0, credit: amount, lineOrder: 2 },
    ];

    const je = await this.postJe(tx, ctx, {
      date: input.dueDate ?? new Date(),
      description: input.description ?? `Inward cheque ${input.chequeNumber}`,
      currencyCode: input.currencyCode,
      exchangeRate,
      sourceType: 'CKR',
      sourceNumber: input.chequeNumber,
      sourceYearId,
      lines,
    });

    await tx.customer.update({
      where: { id: input.customerId },
      data: { balance: { decrement: this.chequeBase(amount, exchangeRate) } },
    });

    return tx.cheque.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        fiscalYearId: ctx.fiscalYearId,
        direction: 'INWARD',
        status: 'UNDER_HAND',
        chequeNumber: input.chequeNumber,
        bankName: input.bankName,
        dueDate: input.dueDate,
        amount: new Decimal(amount),
        currencyCode: input.currencyCode,
        sourceYearId,
        customerId: input.customerId,
        description: input.description,
        portfolioJournalEntryId: je.id,
        invoiceId: extra?.invoiceId,
      },
    });
  }

  async createInwardCheque(
    ctx: TreasuryPostingContext,
    input: CreateInwardChequeInput
  ) {
    await this.assertChequeRight(ctx, 'INWARD', 'post');
    return prisma.$transaction(async (tx) => this.createInwardChequeInTx(tx, ctx, input));
  }

  async sendInwardToBank(ctx: TreasuryPostingContext, chequeId: string) {
    await this.assertChequeRight(ctx, 'INWARD', 'post');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'INWARD' },
    });
    if (!cheque) throw new AppError(404, 'Inward cheque not found');
    assertChequeTransition('INWARD', cheque.status, 'SEND_TO_BANK');

    const accounts = await treasuryAccountResolverService.resolveChequeAccounts(ctx.companyId);
    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);
    const sourceYearId = cheque.sourceYearId ?? (await this.sourceYearId(ctx));

    const lines: JournalEntryLineData[] = [
      {
        accountId: accounts.chequesUnderCollectionAccountId,
        debit: amount,
        credit: 0,
        lineOrder: 1,
      },
      {
        accountId: accounts.chequesUnderHandAccountId,
        debit: 0,
        credit: amount,
        lineOrder: 2,
      },
    ];

    return prisma.$transaction(async (tx) => {
      const je = await this.postJe(tx, ctx, {
        date: new Date(),
        description: `Deposit cheque ${cheque.chequeNumber} for collection`,
        currencyCode: cheque.currencyCode,
        exchangeRate,
        sourceType: 'CKD',
        sourceNumber: cheque.chequeNumber,
        sourceYearId,
        lines,
      });

      return tx.cheque.update({
        where: { id: chequeId },
        data: { status: 'SENT_TO_BANK', depositJournalEntryId: je.id },
      });
    });
  }

  /**
   * Wave 3 fix: reverses `sendInwardToBank` — dated contra entry against the
   * deposit JE, returns the cheque to UNDER_HAND. Only "send" and "clear"
   * had no reversal at all before this (bounce/endorse got theirs in Wave 2).
   */
  async unsendInwardToBank(ctx: TreasuryPostingContext, chequeId: string) {
    await this.assertChequeRight(ctx, 'INWARD', 'unpost');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'INWARD' },
    });
    if (!cheque) throw new AppError(404, 'Inward cheque not found');
    assertChequeTransition('INWARD', cheque.status, 'UNSEND_TO_BANK');
    if (!cheque.depositJournalEntryId) {
      throw new AppError(400, 'Cheque has no deposit journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, cheque.depositJournalEntryId!, {
        reason: 'Cheque deposit-to-bank unposted',
      });

      return tx.cheque.update({
        where: { id: chequeId },
        data: { status: 'UNDER_HAND', depositJournalEntryId: null },
      });
    });
  }

  async clearInwardCheque(
    ctx: TreasuryPostingContext,
    chequeId: string,
    bankAccountId: string
  ) {
    await this.assertChequeRight(ctx, 'INWARD', 'post');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'INWARD' },
    });
    if (!cheque) throw new AppError(404, 'Inward cheque not found');
    assertChequeTransition('INWARD', cheque.status, 'CLEAR');

    await bankBoxRightsService.assertCanPost({
      companyId: ctx.companyId,
      userId: ctx.userId,
      bankAccountId,
    });

    const accounts = await treasuryAccountResolverService.resolveChequeAccounts(ctx.companyId);
    const bankGlId = await treasuryAccountResolverService.resolveBankGlAccountId(
      ctx.companyId,
      bankAccountId
    );
    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);
    const sourceYearId = cheque.sourceYearId ?? (await this.sourceYearId(ctx));

    const lines: JournalEntryLineData[] = [
      { accountId: bankGlId, debit: amount, credit: 0, lineOrder: 1 },
      {
        accountId: accounts.chequesUnderCollectionAccountId,
        debit: 0,
        credit: amount,
        lineOrder: 2,
      },
    ];

    return prisma.$transaction(async (tx) => {
      const je = await this.postJe(tx, ctx, {
        date: new Date(),
        description: `Clear inward cheque ${cheque.chequeNumber}`,
        currencyCode: cheque.currencyCode,
        exchangeRate,
        sourceType: 'CKC',
        sourceNumber: cheque.chequeNumber,
        sourceYearId,
        lines,
      });

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { balance: { increment: this.chequeBase(amount, exchangeRate) } },
      });

      return tx.cheque.update({
        where: { id: chequeId },
        data: {
          status: 'COLLECTED',
          bankAccountId,
          clearJournalEntryId: je.id,
        },
      });
    });
  }

  /**
   * Wave 3 fix: reverses `clearInwardCheque` — dated contra entry against
   * the clear JE, reverses the bank balance increment, and returns the
   * cheque to SENT_TO_BANK.
   */
  async unclearInwardCheque(ctx: TreasuryPostingContext, chequeId: string) {
    await this.assertChequeRight(ctx, 'INWARD', 'unpost');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'INWARD' },
    });
    if (!cheque) throw new AppError(404, 'Inward cheque not found');
    assertChequeTransition('INWARD', cheque.status, 'UNCLEAR');
    if (!cheque.clearJournalEntryId) {
      throw new AppError(400, 'Cheque has no clear journal entry to reverse');
    }
    if (!cheque.bankAccountId) {
      throw new AppError(422, 'Cheque has no bank account to reverse the balance on');
    }

    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, cheque.clearJournalEntryId!, {
        reason: 'Cheque clearing unposted',
      });

      await tx.bankAccount.update({
        where: { id: cheque.bankAccountId! },
        data: { balance: { decrement: this.chequeBase(amount, exchangeRate) } },
      });

      return tx.cheque.update({
        where: { id: chequeId },
        data: { status: 'SENT_TO_BANK', clearJournalEntryId: null },
      });
    });
  }

  /**
   * L2 fix (Item 41): bounce is no longer restricted to `SENT_TO_BANK` — an
   * endorsed cheque (handed to a supplier instead of deposited, see
   * `endorseInwardCheque`) can just as well bounce on the supplier who
   * deposited it, and we're still on the hook for it either way. The GL
   * effect only differs in which account the cheque's carrying value is
   * released from (chequesUnderCollection vs chequesUnderHand).
   */
  async bounceInwardCheque(ctx: TreasuryPostingContext, chequeId: string) {
    await this.assertChequeRight(ctx, 'INWARD', 'post');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'INWARD' },
    });
    if (!cheque) throw new AppError(404, 'Inward cheque not found');
    assertChequeTransition('INWARD', cheque.status, 'BOUNCE');
    if (!cheque.customerId) {
      throw new AppError(422, 'Cheque has no customer for bounce');
    }

    const accounts = await treasuryAccountResolverService.resolveChequeAccounts(ctx.companyId);
    const customerAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
      companyId: ctx.companyId,
      customerId: cheque.customerId,
      invoiceId: cheque.invoiceId,
    });
    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);
    const sourceYearId = cheque.sourceYearId ?? (await this.sourceYearId(ctx));
    const wasEndorsed = cheque.status === 'ENDORSED';
    // An endorsed cheque's carrying value sits in chequesUnderHand (it was
    // never deposited), not chequesUnderCollection.
    const chequeAssetAccountId = wasEndorsed
      ? accounts.chequesUnderHandAccountId
      : accounts.chequesUnderCollectionAccountId;

    const lines: JournalEntryLineData[] = [
      { accountId: customerAccountId, debit: amount, credit: 0, lineOrder: 1 },
      {
        accountId: chequeAssetAccountId,
        debit: 0,
        credit: amount,
        lineOrder: 2,
      },
    ];
    // If it had been endorsed to settle a supplier payable, that payable
    // must be reinstated too — we no longer effectively paid them.
    if (wasEndorsed && cheque.endorsedSupplierId) {
      const supplierAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
        companyId: ctx.companyId,
        supplierId: cheque.endorsedSupplierId,
        invoiceId: cheque.invoiceId,
      });
      lines.push(
        { accountId: chequeAssetAccountId, debit: amount, credit: 0, lineOrder: 3 },
        { accountId: supplierAccountId, debit: 0, credit: amount, lineOrder: 4 }
      );
    }

    return prisma.$transaction(async (tx) => {
      const je = await this.postJe(tx, ctx, {
        date: new Date(),
        description: `Bounce inward cheque ${cheque.chequeNumber}`,
        currencyCode: cheque.currencyCode,
        exchangeRate,
        sourceType: 'CKB',
        sourceNumber: cheque.chequeNumber,
        sourceYearId,
        lines,
      });

      await tx.customer.update({
        where: { id: cheque.customerId! },
        data: { balance: { increment: this.chequeBase(amount, exchangeRate) } },
      });

      if (wasEndorsed && cheque.endorsedSupplierId) {
        // Reinstate the payable the endorsement had reduced — the supplier
        // never actually got paid.
        await tx.supplier.update({
          where: { id: cheque.endorsedSupplierId },
          data: { balance: { increment: this.chequeBase(amount, exchangeRate) } },
        });
      }

      return tx.cheque.update({
        where: { id: chequeId },
        // Wave 2 fix: store the bounce JE id so the bounce can be reversed
        // (see `unbounceInwardCheque`) — previously nothing on the cheque
        // pointed back to it.
        data: { status: 'BOUNCED', bounceJournalEntryId: je.id },
      });
    });
  }

  /**
   * Wave 2 fix: reverses a bounce — dated contra entry against the bounce
   * JE, restores the customer (and, if the cheque had been endorsed,
   * supplier) balance impact, and returns the cheque to whichever status it
   * bounced from (endorsed cheques go back to ENDORSED, everything else
   * back to SENT_TO_BANK).
   */
  async unbounceInwardCheque(ctx: TreasuryPostingContext, chequeId: string) {
    await this.assertChequeRight(ctx, 'INWARD', 'unpost');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'INWARD' },
    });
    if (!cheque) throw new AppError(404, 'Inward cheque not found');
    assertChequeTransition('INWARD', cheque.status, 'UNBOUNCE');
    if (!cheque.bounceJournalEntryId) {
      throw new AppError(400, 'Cheque has no bounce journal entry to reverse');
    }
    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);
    const wasEndorsed = !!cheque.endorsedSupplierId;

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, cheque.bounceJournalEntryId!, {
        reason: 'Cheque bounce unposted',
      });

      await tx.customer.update({
        where: { id: cheque.customerId! },
        data: { balance: { decrement: this.chequeBase(amount, exchangeRate) } },
      });
      if (wasEndorsed && cheque.endorsedSupplierId) {
        await tx.supplier.update({
          where: { id: cheque.endorsedSupplierId },
          data: { balance: { decrement: this.chequeBase(amount, exchangeRate) } },
        });
      }

      return tx.cheque.update({
        where: { id: chequeId },
        data: {
          status: wasEndorsed ? 'ENDORSED' : 'SENT_TO_BANK',
          bounceJournalEntryId: null,
        },
      });
    });
  }

  /**
   * L2 fix (Item 41): endorse (تظهير) an inward cheque still in our
   * portfolio directly to a supplier to settle a payable, instead of
   * depositing it. Releases the cheque's carrying value out of
   * chequesUnderHand and reduces the supplier's balance — the customer's
   * balance is untouched (the receivable was already settled when the
   * cheque was first received).
   */
  async endorseInwardCheque(
    ctx: TreasuryPostingContext,
    chequeId: string,
    supplierId: string,
    notes?: string
  ) {
    await this.assertChequeRight(ctx, 'INWARD', 'post');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'INWARD' },
    });
    if (!cheque) throw new AppError(404, 'Inward cheque not found');
    assertChequeTransition('INWARD', cheque.status, 'ENDORSE');

    const accounts = await treasuryAccountResolverService.resolveChequeAccounts(ctx.companyId);
    const supplierAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
      companyId: ctx.companyId,
      supplierId,
    });
    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);
    const sourceYearId = cheque.sourceYearId ?? (await this.sourceYearId(ctx));

    const lines: JournalEntryLineData[] = [
      { accountId: supplierAccountId, debit: amount, credit: 0, lineOrder: 1 },
      {
        accountId: accounts.chequesUnderHandAccountId,
        debit: 0,
        credit: amount,
        lineOrder: 2,
      },
    ];

    return prisma.$transaction(async (tx) => {
      const je = await this.postJe(tx, ctx, {
        date: new Date(),
        description: notes?.trim()
          ? `Endorse cheque ${cheque.chequeNumber} to supplier — ${notes.trim()}`
          : `Endorse cheque ${cheque.chequeNumber} to supplier`,
        currencyCode: cheque.currencyCode,
        exchangeRate,
        sourceType: 'CKE',
        sourceNumber: cheque.chequeNumber,
        sourceYearId,
        lines,
      });

      // Matches issueOutwardChequeInTx's convention: paying down what we
      // owe the supplier reduces their balance.
      await tx.supplier.update({
        where: { id: supplierId },
        data: { balance: { decrement: this.chequeBase(amount, exchangeRate) } },
      });

      return tx.cheque.update({
        where: { id: chequeId },
        data: {
          status: 'ENDORSED',
          endorsedSupplierId: supplierId,
          endorseJournalEntryId: je.id,
          ...(notes?.trim()
            ? {
                description: cheque.description
                  ? `${cheque.description} — ${notes.trim()}`
                  : notes.trim(),
              }
            : {}),
        },
      });
    });
  }

  /**
   * Wave 2 fix: reverses an endorsement — dated contra entry against the
   * endorse JE, restores the supplier balance, and returns the cheque to
   * UNDER_HAND so it can be deposited or re-endorsed instead.
   */
  async unendorseInwardCheque(ctx: TreasuryPostingContext, chequeId: string) {
    await this.assertChequeRight(ctx, 'INWARD', 'unpost');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'INWARD' },
    });
    if (!cheque) throw new AppError(404, 'Inward cheque not found');
    assertChequeTransition('INWARD', cheque.status, 'UNENDORSE');
    if (!cheque.endorseJournalEntryId || !cheque.endorsedSupplierId) {
      throw new AppError(400, 'Cheque has no endorsement to reverse');
    }
    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, cheque.endorseJournalEntryId!, {
        reason: 'Cheque endorsement unposted',
      });

      await tx.supplier.update({
        where: { id: cheque.endorsedSupplierId! },
        data: { balance: { increment: this.chequeBase(amount, exchangeRate) } },
      });

      return tx.cheque.update({
        where: { id: chequeId },
        data: {
          status: 'UNDER_HAND',
          endorseJournalEntryId: null,
          endorsedSupplierId: null,
        },
      });
    });
  }

  async issueOutwardChequeInTx(
    tx: Prisma.TransactionClient,
    ctx: TreasuryPostingContext,
    input: CreateOutwardChequeInput,
    extra?: { invoiceId?: string }
  ) {
    const accounts = await treasuryAccountResolverService.resolveChequeAccounts(ctx.companyId);
    const supplierAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
      companyId: ctx.companyId,
      supplierId: input.supplierId,
      invoiceId: extra?.invoiceId,
    });
    const amount = input.amount;
    const { exchangeRate } = await this.chequeFx(ctx.companyId, input.currencyCode);
    const sourceYearId = await this.sourceYearId(ctx);

    const lines: JournalEntryLineData[] = [
      { accountId: supplierAccountId, debit: amount, credit: 0, lineOrder: 1 },
      {
        accountId: accounts.notesPayableAccountId,
        debit: 0,
        credit: amount,
        lineOrder: 2,
      },
    ];

    const je = await this.postJe(tx, ctx, {
      date: input.dueDate ?? new Date(),
      description: input.description ?? `Issue outward cheque ${input.chequeNumber}`,
      currencyCode: input.currencyCode,
      exchangeRate,
      sourceType: 'PKI',
      sourceNumber: input.chequeNumber,
      sourceYearId,
      lines,
    });

    await tx.supplier.update({
      where: { id: input.supplierId },
      data: { balance: { decrement: this.chequeBase(amount, exchangeRate) } },
    });

    return tx.cheque.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        fiscalYearId: ctx.fiscalYearId,
        direction: 'OUTWARD',
        status: 'UNDER_HAND',
        chequeNumber: input.chequeNumber,
        bankName: input.bankName,
        dueDate: input.dueDate,
        amount: new Decimal(amount),
        currencyCode: input.currencyCode,
        sourceYearId,
        supplierId: input.supplierId,
        bankAccountId: input.bankAccountId,
        description: input.description,
        issueJournalEntryId: je.id,
        invoiceId: extra?.invoiceId,
      },
    });
  }

  async issueOutwardCheque(ctx: TreasuryPostingContext, input: CreateOutwardChequeInput) {
    await this.assertChequeRight(ctx, 'OUTWARD', 'post');
    return prisma.$transaction(async (tx) => this.issueOutwardChequeInTx(tx, ctx, input));
  }

  async clearOutwardCheque(ctx: TreasuryPostingContext, chequeId: string) {
    await this.assertChequeRight(ctx, 'OUTWARD', 'post');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'OUTWARD' },
    });
    if (!cheque) throw new AppError(404, 'Outward cheque not found');
    assertChequeTransition('OUTWARD', cheque.status, 'CLEAR');
    if (!cheque.bankAccountId) {
      throw new AppError(422, 'Outward cheque has no bank account');
    }

    await bankBoxRightsService.assertCanPost({
      companyId: ctx.companyId,
      userId: ctx.userId,
      bankAccountId: cheque.bankAccountId,
    });

    const accounts = await treasuryAccountResolverService.resolveChequeAccounts(ctx.companyId);
    const bankGlId = await treasuryAccountResolverService.resolveBankGlAccountId(
      ctx.companyId,
      cheque.bankAccountId
    );
    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);
    const sourceYearId = cheque.sourceYearId ?? (await this.sourceYearId(ctx));

    const lines: JournalEntryLineData[] = [
      {
        accountId: accounts.notesPayableAccountId,
        debit: amount,
        credit: 0,
        lineOrder: 1,
      },
      { accountId: bankGlId, debit: 0, credit: amount, lineOrder: 2 },
    ];

    return prisma.$transaction(async (tx) => {
      const je = await this.postJe(tx, ctx, {
        date: new Date(),
        description: `Clear outward cheque ${cheque.chequeNumber}`,
        currencyCode: cheque.currencyCode,
        exchangeRate,
        sourceType: 'PKC',
        sourceNumber: cheque.chequeNumber,
        sourceYearId,
        lines,
      });

      await tx.bankAccount.update({
        where: { id: cheque.bankAccountId! },
        data: { balance: { decrement: this.chequeBase(amount, exchangeRate) } },
      });

      return tx.cheque.update({
        where: { id: chequeId },
        data: { status: 'COLLECTED', clearJournalEntryId: je.id },
      });
    });
  }

  /**
   * Wave 3 fix: reverses `clearOutwardCheque` — dated contra entry against
   * the clear JE, reverses the bank balance decrement, and returns the
   * cheque to UNDER_HAND.
   */
  async unclearOutwardCheque(ctx: TreasuryPostingContext, chequeId: string) {
    await this.assertChequeRight(ctx, 'OUTWARD', 'unpost');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'OUTWARD' },
    });
    if (!cheque) throw new AppError(404, 'Outward cheque not found');
    assertChequeTransition('OUTWARD', cheque.status, 'UNCLEAR');
    if (!cheque.clearJournalEntryId) {
      throw new AppError(400, 'Cheque has no clear journal entry to reverse');
    }
    if (!cheque.bankAccountId) {
      throw new AppError(422, 'Outward cheque has no bank account');
    }

    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, cheque.clearJournalEntryId!, {
        reason: 'Outward cheque clearing unposted',
      });

      await tx.bankAccount.update({
        where: { id: cheque.bankAccountId! },
        data: { balance: { increment: this.chequeBase(amount, exchangeRate) } },
      });

      return tx.cheque.update({
        where: { id: chequeId },
        data: { status: 'UNDER_HAND', clearJournalEntryId: null },
      });
    });
  }

  async updateChequeHeader(
    ctx: TreasuryPostingContext,
    chequeId: string,
    input: {
      chequeNumber?: string;
      bankName?: string | null;
      dueDate?: Date | null;
      description?: string | null;
    }
  ) {
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId },
    });
    if (!cheque) throw new AppError(404, 'Cheque not found');
    if (cheque.status !== 'UNDER_HAND') {
      throw new AppError(400, 'لا يمكن تعديل الشيك إلا وهو في الخزينة');
    }
    return prisma.cheque.update({
      where: { id: chequeId },
      data: {
        ...(input.chequeNumber != null ? { chequeNumber: input.chequeNumber } : {}),
        ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      include: chequePartyInclude,
    }).then(serializeCheque);
  }

  async cancelInwardCheque(ctx: TreasuryPostingContext, chequeId: string) {
    await this.assertChequeRight(ctx, 'INWARD', 'unpost');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'INWARD' },
    });
    if (!cheque) throw new AppError(404, 'Inward cheque not found');
    assertChequeTransition('INWARD', cheque.status, 'CANCEL');
    if (!cheque.customerId) {
      throw new AppError(422, 'Cheque has no customer for cancellation');
    }

    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);

    return prisma.$transaction(async (tx) => {
      if (cheque.portfolioJournalEntryId) {
        await journalPostingService.reverseJournalEntryInTx(tx, ctx, cheque.portfolioJournalEntryId, {
          reason: `Inward cheque ${cheque.chequeNumber} cancelled`,
        });
      }
      await tx.customer.update({
        where: { id: cheque.customerId! },
        data: { balance: { increment: this.chequeBase(amount, exchangeRate) } },
      });
      return tx.cheque.update({
        where: { id: chequeId },
        data: { status: 'CANCELLED' },
        include: chequePartyInclude,
      });
    }).then(serializeCheque);
  }

  async cancelOutwardCheque(ctx: TreasuryPostingContext, chequeId: string) {
    await this.assertChequeRight(ctx, 'OUTWARD', 'unpost');
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId: ctx.companyId, direction: 'OUTWARD' },
    });
    if (!cheque) throw new AppError(404, 'Outward cheque not found');
    assertChequeTransition('OUTWARD', cheque.status, 'CANCEL');
    if (!cheque.supplierId) {
      throw new AppError(422, 'Cheque has no supplier for cancellation');
    }

    const accounts = await treasuryAccountResolverService.resolveChequeAccounts(ctx.companyId);
    const supplierAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
      companyId: ctx.companyId,
      supplierId: cheque.supplierId,
      invoiceId: cheque.invoiceId,
    });
    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);
    const sourceYearId = cheque.sourceYearId ?? (await this.sourceYearId(ctx));

    const lines: JournalEntryLineData[] = [
      {
        accountId: accounts.notesPayableAccountId,
        debit: amount,
        credit: 0,
        lineOrder: 1,
      },
      { accountId: supplierAccountId, debit: 0, credit: amount, lineOrder: 2 },
    ];

    return prisma.$transaction(async (tx) => {
      const je = await this.postJe(tx, ctx, {
        date: new Date(),
        description: `Cancel outward cheque ${cheque.chequeNumber}`,
        currencyCode: cheque.currencyCode,
        exchangeRate,
        sourceType: 'PKX',
        sourceNumber: cheque.chequeNumber,
        sourceYearId,
        lines,
      });

      await tx.supplier.update({
        where: { id: cheque.supplierId! },
        data: { balance: { increment: this.chequeBase(amount, exchangeRate) } },
      });

      return tx.cheque.update({
        where: { id: chequeId },
        data: { status: 'CANCELLED', cancelJournalEntryId: je.id },
      });
    });
  }

  /**
   * Void a portfolio/issued cheque that is still linked to an invoice being unposted.
   * Banked or cleared cheques must be rejected by the caller before this is invoked.
   */
  async voidLinkedChequeOnInvoiceUnpostInTx(
    tx: Prisma.TransactionClient,
    ctx: TreasuryPostingContext,
    cheque: {
      id: string;
      direction: string;
      status: string;
      amount: Prisma.Decimal | number;
      currencyCode?: string | null;
      customerId: string | null;
      supplierId: string | null;
      portfolioJournalEntryId: string | null;
      issueJournalEntryId: string | null;
    }
  ) {
    const amount = Number(cheque.amount);
    const { exchangeRate } = await this.chequeFx(ctx.companyId, cheque.currencyCode);
    const glUnPost = await companySettingService.getFlag(ctx.companyId, 'GLUnPost', true);
    const jeId =
      cheque.direction === 'OUTWARD'
        ? cheque.issueJournalEntryId
        : cheque.portfolioJournalEntryId;

    if (cheque.direction === 'INWARD' && cheque.status === 'UNDER_HAND' && cheque.customerId) {
      await tx.customer.update({
        where: { id: cheque.customerId },
        data: { balance: { increment: this.chequeBase(amount, exchangeRate) } },
      });
    }

    if (cheque.direction === 'OUTWARD' && cheque.status === 'UNDER_HAND' && cheque.supplierId) {
      await tx.supplier.update({
        where: { id: cheque.supplierId },
        data: { balance: { increment: this.chequeBase(amount, exchangeRate) } },
      });
    }

    if (glUnPost && jeId) {
      // C11 fix: reverse the cheque's portfolio/issue JE with a dated contra
      // entry instead of flag-flipping it back to "unposted".
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, jeId, {
        reason: `Cheque ${cheque.id.slice(0, 8)} voided`,
      });
    }

    return tx.cheque.update({
      where: { id: cheque.id },
      data: { status: 'CANCELLED', invoiceId: null },
    });
  }

  async getCheque(companyId: string, chequeId: string) {
    const cheque = await prisma.cheque.findFirst({
      where: { id: chequeId, companyId },
      include: chequePartyInclude,
    });
    if (!cheque) throw new AppError(404, 'Cheque not found');
    return serializeCheque(cheque);
  }

  async listCheques(
    companyId: string,
    query: {
      direction?: ChequeDirection;
      status?: ChequeStatus;
      partyId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 200) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ChequeWhereInput = { companyId };
    if (query.direction) where.direction = query.direction;
    if (query.status) where.status = query.status;

    if (query.dateFrom || query.dateTo) {
      const dueDate: Prisma.DateTimeFilter = {};
      if (query.dateFrom) dueDate.gte = query.dateFrom;
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
          end.setHours(23, 59, 59, 999);
        }
        dueDate.lte = end;
      }
      where.dueDate = dueDate;
    }

    const and: Prisma.ChequeWhereInput[] = [];
    if (query.partyId) {
      and.push({
        OR: [
          { customerId: query.partyId },
          { supplierId: query.partyId },
          { endorsedSupplierId: query.partyId },
        ],
      });
    }
    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [{ chequeNumber: { contains: search } }, { bankName: { contains: search } }],
      });
    }
    if (and.length) where.AND = and;

    const [rows, total, sum] = await Promise.all([
      prisma.cheque.findMany({
        where,
        include: chequePartyInclude,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.cheque.count({ where }),
      prisma.cheque.aggregate({ where, _sum: { amount: true } }),
    ]);

    const items = rows.map(serializeCheque);
    const totalAmount = Number(sum._sum.amount ?? 0);
    return {
      items,
      total,
      page,
      totalAmount,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getChequeStats(companyId: string, direction?: ChequeDirection) {
    const base: Prisma.ChequeWhereInput = { companyId };
    if (direction) base.direction = direction;

    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endWeek = new Date(startToday);
    endWeek.setDate(endWeek.getDate() + 7);
    endWeek.setHours(23, 59, 59, 999);

    const [underHand, dueThisWeek, bounced] = await Promise.all([
      prisma.cheque.aggregate({
        where: { ...base, status: 'UNDER_HAND' },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.cheque.aggregate({
        where: {
          ...base,
          status: { in: ['UNDER_HAND', 'SENT_TO_BANK'] },
          dueDate: { gte: startToday, lte: endWeek },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.cheque.aggregate({
        where: { ...base, status: 'BOUNCED' },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      underHandCount: underHand._count._all,
      underHandAmount: Number(underHand._sum.amount ?? 0),
      dueThisWeekCount: dueThisWeek._count._all,
      dueThisWeekAmount: Number(dueThisWeek._sum.amount ?? 0),
      bouncedCount: bounced._count._all,
      bouncedAmount: Number(bounced._sum.amount ?? 0),
    };
  }
}

export const chequeLifecycleService = new ChequeLifecycleService();
