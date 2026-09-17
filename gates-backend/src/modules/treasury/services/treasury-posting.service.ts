import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { autoGlPostingService } from '../../accounting/services/auto-gl-posting.service';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { advancedRightsService } from '../../platform/services/advanced-rights.service';
import { bankBoxRightsService } from './bank-box-rights.service';
import { treasuryAccountResolverService } from './treasury-account-resolver.service';
import {
  ensureCashTransactionFromPayment,
  ensureCashTransactionFromReceipt,
} from './cash-transaction.service';
import type { TreasuryPostingContext } from '../types/treasury.types';
import { cashDisbursementWorkflowService } from './cash-disbursement-workflow.service';
import { splitVoucherLineForeignTotals, splitVoucherLineTotals } from '../types/vouchers.dto';
import { asFxRate } from '../../accounting/utils/company-fx-rate';

type CashTx = Prisma.CashTransactionGetPayload<{
  include: {
    treasuryReceipt: true;
    treasuryPayment: true;
    lines: true;
  };
}>;

/**
 * Legacy `AdvancedRights` cash-voucher families: `B` is the cash box (صندوق)
 * and `K` the bank, `R` a receipt and `P` a payment — so a bank payment
 * voucher is `CashKPPost` (`legacy-advanced-rights-families.ts`, read by
 * `UntBP.pas`). A row carrying a `bankAccountId` is the bank side; anything
 * else (safe or pure GL contra) is treated as the box side, matching how
 * `bankBoxRightsService.assertCanPost` discriminates the same two columns.
 */
function cashVoucherRightKey(
  row: { transactionKind: string; bankAccountId?: string | null },
  mode: 'post' | 'unpost'
): string {
  const isBank = Boolean(row.bankAccountId);
  const isReceipt = row.transactionKind === 'RECEIPT';
  const family = isBank ? (isReceipt ? 'cashKr' : 'cashKp') : isReceipt ? 'cashBr' : 'cashBp';
  return mode === 'post' ? `${family}Post` : `${family}Unpost`;
}

export class TreasuryPostingService {
  private async allocateGlNumInTx(
    tx: Prisma.TransactionClient,
    ctx: JournalPostingContext
  ): Promise<string | undefined> {
    return documentSequenceService.nextGlNumberInTx(tx, ctx);
  }

  private async loadCashTransaction(companyId: string, id: string): Promise<CashTx> {
    const row = await prisma.cashTransaction.findFirst({
      where: { id, companyId },
      include: { treasuryReceipt: true, treasuryPayment: true, lines: true },
    });
    if (!row) {
      throw new AppError(404, 'Cash transaction not found');
    }
    return row;
  }

  private async resolveSourceYearId(
    ctx: TreasuryPostingContext,
    explicit?: string | null
  ): Promise<string> {
    if (explicit) return explicit;
    const fy = await prisma.fiscalYear.findFirst({
      where: { id: ctx.fiscalYearId, companyId: ctx.companyId },
      select: { legacyYearId: true },
    });
    return fy?.legacyYearId ?? String(new Date().getUTCFullYear());
  }

  private async buildReceiptLines(
    companyId: string,
    tx: CashTx
  ): Promise<{ lines: JournalEntryLineData[]; amount: number }> {
    const amount = Number(tx.amount);
    if (!tx.safeId && !tx.bankAccountId) {
      throw new AppError(422, 'Cash receipt requires a safe or bank account destination');
    }

    const destAccountId = tx.safeId
      ? await treasuryAccountResolverService.resolveSafeGlAccountId(companyId, tx.safeId)
      : await treasuryAccountResolverService.resolveBankGlAccountId(
          companyId,
          tx.bankAccountId!
        );

    const voucherLines = tx.lines ?? [];
    if (voucherLines.length > 0) {
      const debitLegs: JournalEntryLineData[] = [];
      const creditLegs: JournalEntryLineData[] = [];
      const hasCreditLeg = voucherLines.some(
        (row) => (row as { entrySide?: string }).entrySide === 'CREDIT'
      );
      let order = 2;
      for (const line of voucherLines) {
        const rate = asFxRate(line.exchangeRate ?? tx.exchangeRate, 1);
        const lineAmount = Number(line.amount);
        const side =
          (line as { entrySide?: string }).entrySide === 'DEBIT' && hasCreditLeg ? 'DEBIT' : 'CREDIT';
        const row: JournalEntryLineData = {
          accountId: line.accountId,
          debit: side === 'DEBIT' ? lineAmount : 0,
          credit: side === 'CREDIT' ? lineAmount : 0,
          lineOrder: order,
          costCenterId: line.costCenterId ?? undefined,
          description: line.description ?? undefined,
          exchangeRate: rate,
          partnerId: tx.customerId ?? tx.supplierId ?? undefined,
          partnerType: tx.customerId ? 'CUSTOMER' : tx.supplierId ? 'SUPPLIER' : undefined,
        };
        order += 1;
        if (side === 'DEBIT') debitLegs.push(row);
        else creditLegs.push(row);
      }
      const debitTotal = debitLegs.reduce(
        (sum, line) => sum + line.debit * asFxRate(line.exchangeRate, 1),
        0
      );
      const creditTotal = creditLegs.reduce(
        (sum, line) => sum + line.credit * asFxRate(line.exchangeRate, 1),
        0
      );
      const netCashBase = creditTotal - debitTotal;
      const headerRate = asFxRate(tx.exchangeRate, 1);
      const netCashForeign = splitVoucherLineForeignTotals(
        voucherLines.map((line) => ({
          amount: Number(line.amount),
          entrySide:
            (line as { entrySide?: string }).entrySide === 'DEBIT' && hasCreditLeg
              ? 'DEBIT'
              : 'CREDIT',
        })),
        'RECEIPT'
      ).netCash;
      if (netCashBase <= 0 || netCashForeign <= 0) {
        throw new AppError(
          422,
          tx.bankAccountId
            ? 'صافي المضاف للبنك يجب أن يكون أكبر من صفر'
            : 'صافي المقبوض بالخزنة يجب أن يكون أكبر من صفر'
        );
      }
      let lineOrder = 1;
      return {
        amount: netCashBase,
        lines: [
          {
            accountId: destAccountId,
            debit: netCashForeign,
            credit: 0,
            lineOrder: lineOrder++,
            exchangeRate: headerRate,
          },
          ...debitLegs.map((line) => ({ ...line, lineOrder: lineOrder++ })),
          ...creditLegs.map((line) => ({ ...line, lineOrder: lineOrder++ })),
        ],
      };
    }

    const creditAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
      companyId,
      customerId: tx.customerId,
      supplierId: tx.supplierId,
      offsetAccountId: tx.offsetAccountId,
      invoiceId: tx.invoiceId,
    });

    const partyId = tx.customerId ?? tx.supplierId ?? undefined;
    const partnerType = tx.customerId ? 'CUSTOMER' : tx.supplierId ? 'SUPPLIER' : undefined;
    const rate = asFxRate(tx.exchangeRate, 1);
    return {
      amount: amount * rate,
      lines: [
        {
          accountId: destAccountId,
          debit: amount,
          credit: 0,
          lineOrder: 1,
          exchangeRate: rate,
        },
        {
          accountId: creditAccountId,
          debit: 0,
          credit: amount,
          lineOrder: 2,
          exchangeRate: rate,
          partnerId: partyId,
          partnerType,
        },
      ],
    };
  }

  private async buildPaymentLines(
    companyId: string,
    tx: CashTx
  ): Promise<{ lines: JournalEntryLineData[]; amount: number }> {
    const amount = Number(tx.amount);
    if (!tx.safeId && !tx.bankAccountId) {
      throw new AppError(422, 'Cash payment requires a safe or bank account source');
    }

    const sourceAccountId = tx.safeId
      ? await treasuryAccountResolverService.resolveSafeGlAccountId(companyId, tx.safeId)
      : await treasuryAccountResolverService.resolveBankGlAccountId(
          companyId,
          tx.bankAccountId!
        );

    const voucherLines = tx.lines ?? [];
    if (voucherLines.length > 0) {
      const debitLegs: JournalEntryLineData[] = [];
      const creditLegs: JournalEntryLineData[] = [];
      let order = 1;
      for (const line of voucherLines) {
        const rate = asFxRate(line.exchangeRate ?? tx.exchangeRate, 1);
        const lineAmount = Number(line.amount);
        const side = (line as { entrySide?: string }).entrySide === 'CREDIT' ? 'CREDIT' : 'DEBIT';
        const row: JournalEntryLineData = {
          accountId: line.accountId,
          debit: side === 'DEBIT' ? lineAmount : 0,
          credit: side === 'CREDIT' ? lineAmount : 0,
          lineOrder: order,
          costCenterId: line.costCenterId ?? undefined,
          description: line.description ?? undefined,
          exchangeRate: rate,
          partnerId: tx.supplierId ?? tx.customerId ?? undefined,
          partnerType: tx.supplierId ? 'SUPPLIER' : tx.customerId ? 'CUSTOMER' : undefined,
        };
        order += 1;
        if (side === 'CREDIT') creditLegs.push(row);
        else debitLegs.push(row);
      }
      const debitTotal = debitLegs.reduce(
        (sum, line) => sum + line.debit * asFxRate(line.exchangeRate, 1),
        0
      );
      const creditTotal = creditLegs.reduce(
        (sum, line) => sum + line.credit * asFxRate(line.exchangeRate, 1),
        0
      );
      const netCashBase = debitTotal - creditTotal;
      const headerRate = asFxRate(tx.exchangeRate, 1);
      const netCashForeign = splitVoucherLineForeignTotals(
        voucherLines.map((line) => ({
          amount: Number(line.amount),
          entrySide: (line as { entrySide?: string }).entrySide === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        })),
        'PAYMENT'
      ).netCash;
      if (netCashBase <= 0 || netCashForeign <= 0) {
        throw new AppError(
          422,
          tx.bankAccountId
            ? 'صافي المخصوم من البنك يجب أن يكون أكبر من صفر'
            : 'صافي المنصرف من الخزنة يجب أن يكون أكبر من صفر'
        );
      }
      return {
        amount: netCashBase,
        lines: [
          ...debitLegs,
          ...creditLegs,
          {
            accountId: sourceAccountId,
            debit: 0,
            credit: netCashForeign,
            lineOrder: order,
            exchangeRate: headerRate,
          },
        ],
      };
    }

    const debitAccountId = await treasuryAccountResolverService.resolvePartyAccountId({
      companyId,
      customerId: tx.customerId,
      supplierId: tx.supplierId,
      offsetAccountId: tx.offsetAccountId,
      invoiceId: tx.invoiceId,
    });

    const partyId = tx.customerId ?? tx.supplierId ?? undefined;
    const partnerType = tx.customerId ? 'CUSTOMER' : tx.supplierId ? 'SUPPLIER' : undefined;
    const rate = asFxRate(tx.exchangeRate, 1);
    return {
      amount: amount * rate,
      lines: [
        {
          accountId: debitAccountId,
          debit: amount,
          credit: 0,
          lineOrder: 1,
          exchangeRate: rate,
          partnerId: partyId,
          partnerType,
        },
        {
          accountId: sourceAccountId,
          debit: 0,
          credit: amount,
          lineOrder: 2,
          exchangeRate: rate,
        },
      ],
    };
  }

  private receiptPartySettlement(row: CashTx, fallback: number): number {
    const lines = row.lines ?? [];
    if (!lines.length) return fallback;
    const { creditTotal } = splitVoucherLineTotals(
      lines.map((line) => ({
        amount: Number(line.amount),
        exchangeRate: line.exchangeRate != null ? Number(line.exchangeRate) : 1,
        entrySide: line.entrySide ?? 'CREDIT',
      })),
      'RECEIPT'
    );
    return creditTotal > 0 ? creditTotal : fallback;
  }

  private async applyReceiptBalances(tx: Prisma.TransactionClient, row: CashTx, amount: number) {
    const partyAmount = this.receiptPartySettlement(row, amount);
    if (row.safeId) {
      await tx.safe.update({
        where: { id: row.safeId },
        data: { balance: { increment: new Decimal(amount) } },
      });
    }
    if (row.bankAccountId) {
      await tx.bankAccount.update({
        where: { id: row.bankAccountId },
        data: { balance: { increment: new Decimal(amount) } },
      });
    }
    if (row.customerId) {
      await tx.customer.update({
        where: { id: row.customerId },
        data: { balance: { decrement: new Decimal(partyAmount) } },
      });
    }
    if (row.supplierId) {
      await tx.supplier.update({
        where: { id: row.supplierId },
        data: { balance: { increment: new Decimal(partyAmount) } },
      });
    }
  }

  private async reverseReceiptBalances(tx: Prisma.TransactionClient, row: CashTx, amount: number) {
    const partyAmount = this.receiptPartySettlement(row, amount);
    if (row.safeId) {
      await tx.safe.update({
        where: { id: row.safeId },
        data: { balance: { decrement: new Decimal(amount) } },
      });
    }
    if (row.bankAccountId) {
      await tx.bankAccount.update({
        where: { id: row.bankAccountId },
        data: { balance: { decrement: new Decimal(amount) } },
      });
    }
    if (row.customerId) {
      await tx.customer.update({
        where: { id: row.customerId },
        data: { balance: { increment: new Decimal(partyAmount) } },
      });
    }
    if (row.supplierId) {
      await tx.supplier.update({
        where: { id: row.supplierId },
        data: { balance: { decrement: new Decimal(partyAmount) } },
      });
    }
  }

  private async applyPaymentBalances(tx: Prisma.TransactionClient, row: CashTx, amount: number) {
    if (row.safeId) {
      await tx.safe.update({
        where: { id: row.safeId },
        data: { balance: { decrement: new Decimal(amount) } },
      });
    }
    if (row.bankAccountId) {
      await tx.bankAccount.update({
        where: { id: row.bankAccountId },
        data: { balance: { decrement: new Decimal(amount) } },
      });
    }
    if (row.customerId) {
      await tx.customer.update({
        where: { id: row.customerId },
        data: { balance: { increment: new Decimal(amount) } },
      });
    }
    if (row.supplierId) {
      await tx.supplier.update({
        where: { id: row.supplierId },
        data: { balance: { decrement: new Decimal(amount) } },
      });
    }
  }

  private async reversePaymentBalances(tx: Prisma.TransactionClient, row: CashTx, amount: number) {
    if (row.safeId) {
      await tx.safe.update({
        where: { id: row.safeId },
        data: { balance: { increment: new Decimal(amount) } },
      });
    }
    if (row.bankAccountId) {
      await tx.bankAccount.update({
        where: { id: row.bankAccountId },
        data: { balance: { increment: new Decimal(amount) } },
      });
    }
    if (row.customerId) {
      await tx.customer.update({
        where: { id: row.customerId },
        data: { balance: { decrement: new Decimal(amount) } },
      });
    }
    if (row.supplierId) {
      await tx.supplier.update({
        where: { id: row.supplierId },
        data: { balance: { increment: new Decimal(amount) } },
      });
    }
  }

  async postCashTransactionInTx(
    tx: Prisma.TransactionClient,
    ctx: TreasuryPostingContext,
    cashTransactionId: string
  ) {
    const row = await tx.cashTransaction.findFirst({
      where: { id: cashTransactionId, companyId: ctx.companyId },
      include: { treasuryReceipt: true, treasuryPayment: true, lines: true },
    });
    if (!row) {
      throw new AppError(404, 'Cash transaction not found');
    }
    if (row.isCancelled) {
      throw new AppError(400, 'Cannot post a cancelled cash transaction');
    }
    if (row.isPosted) {
      return row;
    }

    const sourceYearId = await this.resolveSourceYearId(ctx, null);
    const legacyGlNum = await this.allocateGlNumInTx(tx, ctx);
    const voucherRef = row.voucherNumber ?? row.id.slice(0, 8);

    const isReceipt = row.transactionKind === 'RECEIPT';
    const cashRow: CashTx = row;
    const { lines, amount } = isReceipt
      ? await this.buildReceiptLines(ctx.companyId, cashRow)
      : await this.buildPaymentLines(ctx.companyId, cashRow);

    const je = await autoGlPostingService.commitInTx(tx, ctx, {
      fiscalYearId: ctx.fiscalYearId!,
      legacyGlNum,
      date: row.date,
      description: row.description ?? `Cash ${row.transactionKind} ${voucherRef}`,
      currencyCode: row.currencyCode,
      // Wave 2 fix: previously always defaulted to 1 even for genuinely
      // foreign-currency transactions, so debitBase/creditBase never
      // reflected an actual conversion.
      exchangeRate: row.exchangeRate != null ? Number(row.exchangeRate) : undefined,
      entryType: 'CashTrx',
      sourceType: isReceipt ? 'CR' : 'CP',
      sourceId: row.id,
      sourceNumber: voucherRef,
      sourceYearId,
      lines,
    });
    if (!je) {
      throw new AppError(422, 'Treasury GL posting was skipped');
    }

    if (isReceipt) {
      await this.applyReceiptBalances(tx, cashRow, amount);
    } else {
      await this.applyPaymentBalances(tx, cashRow, amount);
    }

    await tx.cashTransaction.update({
      where: { id: cashTransactionId },
      data: {
        isPosted: true,
        postedAt: new Date(),
        postedBy: ctx.userId,
        journalEntryId: je.id,
        fiscalYearId: ctx.fiscalYearId,
        workflowStatus: 'POSTED',
        version: { increment: 1 },
      },
    });

    if (row.treasuryReceiptId) {
      await tx.treasuryReceipt.update({
        where: { id: row.treasuryReceiptId },
        data: {
          isPosted: true,
          postedAt: new Date(),
          postedBy: ctx.userId,
          journalEntryId: je.id,
          fiscalYearId: ctx.fiscalYearId,
        },
      });
    }
    if (row.treasuryPaymentId) {
      await tx.treasuryPayment.update({
        where: { id: row.treasuryPaymentId },
        data: {
          isPosted: true,
          postedAt: new Date(),
          postedBy: ctx.userId,
          journalEntryId: je.id,
          fiscalYearId: ctx.fiscalYearId,
        },
      });
    }

    // Pre-existing bug fix: this used to `return row`, the pre-update
    // snapshot fetched at the top of the function (isPosted: false,
    // journalEntryId: null) — every caller of postCashTransaction was
    // seeing "not posted" immediately after a successful post.
    return tx.cashTransaction.findFirstOrThrow({
      where: { id: cashTransactionId, companyId: ctx.companyId },
      include: { treasuryReceipt: true, treasuryPayment: true, lines: true },
    });
  }

  async rewritePostedCashJournal(
    ctx: TreasuryPostingContext,
    cashTransactionId: string,
    previous: CashTx
  ) {
    const next = await this.loadCashTransaction(ctx.companyId, cashTransactionId);
    if (!next.journalEntryId) {
      throw new AppError(422, 'السند ليس له قيد محاسبي لتعديله');
    }
    if (next.isCancelled) {
      throw new AppError(400, 'Cannot rewrite a cancelled cash transaction');
    }

    return prisma.$transaction(async (tx) => {
      const isReceipt = previous.transactionKind === 'RECEIPT';
      const previousAmount = Number(previous.amount);
      if (isReceipt) {
        await this.reverseReceiptBalances(tx, previous, previousAmount);
      } else {
        await this.reversePaymentBalances(tx, previous, previousAmount);
      }

      const cashRow: CashTx = next;
      const { lines, amount } = isReceipt
        ? await this.buildReceiptLines(ctx.companyId, cashRow)
        : await this.buildPaymentLines(ctx.companyId, cashRow);
      const voucherRef = next.voucherNumber ?? next.id.slice(0, 8);

      await journalPostingService.replacePostedJournalInTx(tx, ctx, next.journalEntryId!, {
        date: next.date,
        hijriDate: next.hijriDate,
        description: next.description ?? `Cash ${next.transactionKind} ${voucherRef}`,
        currencyCode: next.currencyCode,
        exchangeRate: next.exchangeRate != null ? Number(next.exchangeRate) : undefined,
        sourceNumber: voucherRef,
        lines,
      });

      if (isReceipt) {
        await this.applyReceiptBalances(tx, cashRow, amount);
      } else {
        await this.applyPaymentBalances(tx, cashRow, amount);
      }

      await tx.cashTransaction.update({
        where: { id: cashTransactionId },
        data: { version: { increment: 1 } },
      });

      return tx.cashTransaction.findFirstOrThrow({
        where: { id: cashTransactionId, companyId: ctx.companyId },
        include: { treasuryReceipt: true, treasuryPayment: true, lines: true },
      });
    });
  }

  async postCashTransaction(ctx: TreasuryPostingContext, cashTransactionId: string) {
    const row = await this.loadCashTransaction(ctx.companyId, cashTransactionId);

    if (row.isCancelled) {
      throw new AppError(400, 'Cannot post a cancelled cash transaction');
    }
    if (row.isPosted) {
      throw new AppError(400, 'Cash transaction is already posted');
    }
    if ((row.documentRole ?? 'VOUCHER') === 'ORDER') {
      throw new AppError(422, 'أوامر الصرف والتوريد لا تُرحّل محاسبياً — أكّد التنفيذ من شاشة الأمر');
    }

    await advancedRightsService.assertCanPostFamily(
      ctx.companyId,
      ctx.userId,
      ctx.branchId,
      cashVoucherRightKey(row, 'post'),
      { isAdmin: ctx.isAdmin, actionLabel: 'post cash/bank vouchers' }
    );

    await bankBoxRightsService.assertCanPost({
      companyId: ctx.companyId,
      userId: ctx.userId,
      safeId: row.safeId,
      bankAccountId: row.bankAccountId,
    });

    if ((row.documentRole ?? 'VOUCHER') === 'VOUCHER') {
      await cashDisbursementWorkflowService.assertCanPost(ctx.companyId, cashTransactionId);
    }

    return prisma.$transaction(async (tx) =>
      this.postCashTransactionInTx(tx, ctx, cashTransactionId)
    );
  }

  /**
   * Reverse a posted cash transaction inside an existing Prisma transaction.
   * Used by invoice unpost so cash GL/safes unwind atomically with the invoice.
   */
  async unpostCashTransactionInTx(
    tx: Prisma.TransactionClient,
    ctx: TreasuryPostingContext,
    cashTransactionId: string,
    options?: { cancel?: boolean }
  ) {
    const row = await tx.cashTransaction.findFirst({
      where: { id: cashTransactionId, companyId: ctx.companyId },
      include: { treasuryReceipt: true, treasuryPayment: true, lines: true },
    });
    if (!row) {
      throw new AppError(404, 'Cash transaction not found');
    }
    if (row.isCancelled && !row.isPosted) {
      return row;
    }

    const amount = Number(row.amount);
    const isReceipt = row.transactionKind === 'RECEIPT';

    if (row.isPosted) {
      if (row.journalEntryId) {
        if (isReceipt) {
          await this.reverseReceiptBalances(tx, row, amount);
        } else {
          await this.reversePaymentBalances(tx, row, amount);
        }
        await journalPostingService.cascadeSourceJournalInTx(
          tx,
          ctx.companyId,
          [row.journalEntryId],
          options?.cancel ? 'cancel' : 'unpost',
          ctx.userId
        );
      }

      await tx.cashTransaction.update({
        where: { id: cashTransactionId },
        data: {
          isPosted: false,
          postedAt: null,
          postedBy: null,
          ...(options?.cancel ? { isCancelled: true } : {}),
        },
      });

      if (row.treasuryReceiptId) {
        await tx.treasuryReceipt.update({
          where: { id: row.treasuryReceiptId },
          data: {
            isPosted: false,
            postedAt: null,
            postedBy: null,
            ...(options?.cancel ? { isCancelled: true } : {}),
          },
        });
      }
      if (row.treasuryPaymentId) {
        await tx.treasuryPayment.update({
          where: { id: row.treasuryPaymentId },
          data: {
            isPosted: false,
            postedAt: null,
            postedBy: null,
            ...(options?.cancel ? { isCancelled: true } : {}),
          },
        });
      }
    } else if (options?.cancel) {
      await journalPostingService.cascadeSourceJournalInTx(
        tx,
        ctx.companyId,
        [row.journalEntryId],
        'cancel',
        ctx.userId
      );
      await tx.cashTransaction.update({
        where: { id: cashTransactionId },
        data: { isCancelled: true },
      });
      if (row.treasuryReceiptId) {
        await tx.treasuryReceipt.update({
          where: { id: row.treasuryReceiptId },
          data: { isCancelled: true },
        });
      }
      if (row.treasuryPaymentId) {
        await tx.treasuryPayment.update({
          where: { id: row.treasuryPaymentId },
          data: { isCancelled: true },
        });
      }
    }

    return tx.cashTransaction.findUnique({ where: { id: cashTransactionId } });
  }

  async unpostCashTransaction(ctx: TreasuryPostingContext, cashTransactionId: string) {
    const row = await this.loadCashTransaction(ctx.companyId, cashTransactionId);

    if (!row.isPosted) {
      throw new AppError(400, 'Cash transaction is not posted');
    }
    if (!row.journalEntryId) {
      throw new AppError(400, 'Cash transaction has no linked journal entry');
    }

    await advancedRightsService.assertCanPostFamily(
      ctx.companyId,
      ctx.userId,
      ctx.branchId,
      cashVoucherRightKey(row, 'unpost'),
      { isAdmin: ctx.isAdmin, actionLabel: 'unpost cash/bank vouchers' }
    );

    return prisma.$transaction(async (tx) =>
      this.unpostCashTransactionInTx(tx, ctx, cashTransactionId)
    );
  }

  async postFromTreasuryReceipt(ctx: TreasuryPostingContext, receiptId: string) {
    const cashTx = await ensureCashTransactionFromReceipt(ctx.companyId, receiptId);
    return this.postCashTransaction(ctx, cashTx.id);
  }

  async unpostFromTreasuryReceipt(ctx: TreasuryPostingContext, receiptId: string) {
    const cashTx = await ensureCashTransactionFromReceipt(ctx.companyId, receiptId);
    return this.unpostCashTransaction(ctx, cashTx.id);
  }

  async postFromTreasuryPayment(ctx: TreasuryPostingContext, paymentId: string) {
    const cashTx = await ensureCashTransactionFromPayment(ctx.companyId, paymentId);
    return this.postCashTransaction(ctx, cashTx.id);
  }

  async unpostFromTreasuryPayment(ctx: TreasuryPostingContext, paymentId: string) {
    const cashTx = await ensureCashTransactionFromPayment(ctx.companyId, paymentId);
    return this.unpostCashTransaction(ctx, cashTx.id);
  }
}

export const treasuryPostingService = new TreasuryPostingService();
