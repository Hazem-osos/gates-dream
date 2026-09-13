import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { taxEngineService } from './tax-engine.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';

type AccountDefs = Record<string, string | undefined>;

export class TaxDeclarationPostingService {
  private pick(defs: AccountDefs | null, keys: string[]): string | undefined {
    if (!defs) return undefined;
    for (const k of keys) {
      const v = defs[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  }

  private async resolveTaxAccounts(companyId: string) {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { accountDefinitions: true },
    });
    const defs = (settings?.accountDefinitions ?? {}) as AccountDefs;

    const outputRaw = this.pick(defs, ['vatOutputAccount', 'salesTaxAccount']);
    const inputRaw = this.pick(defs, ['vatInputAccount', 'purchaseTaxAccount']);
    const authorityRaw = this.pick(defs, [
      'taxAuthorityPayableAccount',
      'vatPayableAccount',
      'withholdingTaxAccount',
    ]);

    if (!outputRaw || !inputRaw || !authorityRaw) {
      throw new AppError(
        422,
        'VAT output, input, and tax authority accounts must be configured in accountDefinitions'
      );
    }

    const [vatOutputAccountId, vatInputAccountId, taxAuthorityAccountId] = await Promise.all([
      invoiceAccountResolverService.resolveAccountId(companyId, outputRaw),
      invoiceAccountResolverService.resolveAccountId(companyId, inputRaw),
      invoiceAccountResolverService.resolveAccountId(companyId, authorityRaw),
    ]);

    return { vatOutputAccountId, vatInputAccountId, taxAuthorityAccountId };
  }

  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  async postVatSettlement(ctx: JournalPostingContext, declarationId: string) {
    const declaration = await prisma.taxDeclaration.findFirst({
      where: { id: declarationId, companyId: ctx.companyId },
      include: { taxPeriod: true },
    });
    if (!declaration) throw new AppError(404, 'Tax declaration not found');
    if (declaration.status === 'SETTLED') {
      throw new AppError(400, 'Tax declaration is already settled');
    }
    if (declaration.taxPeriod.status === 'CLOSED') {
      throw new AppError(403, 'Cannot settle VAT for a closed tax period');
    }

    const refreshed = await taxEngineService.buildOrRefreshDeclaration(
      ctx.companyId,
      declaration.taxPeriodId
    );

    const output = roundTo4(Number(refreshed.totalOutputVat));
    const input = roundTo4(Number(refreshed.totalInputVat));
    const net = roundTo4(Number(refreshed.netVatAmount));

    if (output === 0 && input === 0) {
      throw new AppError(422, 'No VAT activity to settle for this period');
    }

    const accounts = await this.resolveTaxAccounts(ctx.companyId);
    const lines: JournalEntryLineData[] = [];
    let order = 1;

    if (output > 0) {
      lines.push({
        accountId: accounts.vatOutputAccountId,
        debit: output,
        credit: 0,
        lineOrder: order++,
        description: 'Clear output VAT',
      });
    }
    if (input > 0) {
      lines.push({
        accountId: accounts.vatInputAccountId,
        debit: 0,
        credit: input,
        lineOrder: order++,
        description: 'Clear input VAT',
      });
    }
    if (net > 0) {
      lines.push({
        accountId: accounts.taxAuthorityAccountId,
        debit: 0,
        credit: net,
        lineOrder: order++,
        description: 'Net VAT payable to authority',
      });
    } else if (net < 0) {
      lines.push({
        accountId: accounts.taxAuthorityAccountId,
        debit: Math.abs(net),
        credit: 0,
        lineOrder: order++,
        description: 'Net VAT recoverable from authority',
      });
    }

    const legacyGlNum = await this.allocateGlNum(ctx);
    const sourceYearId =
      declaration.taxPeriod.sourceYearId ??
      (
        await prisma.fiscalYear.findFirst({
          where: { id: declaration.taxPeriod.fiscalYearId },
          select: { legacyYearId: true },
        })
      )?.legacyYearId ??
      String(new Date().getUTCFullYear());

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: new Date(),
        description: `VAT settlement — period ${declaration.taxPeriod.periodNumber}`,
        currencyCode: 'EGP',
        entryType: 'Tax',
        sourceType: 'VAT',
        sourceNumber: String(declaration.taxPeriod.periodNumber),
        sourceYearId,
        lines,
      });

      return tx.taxDeclaration.update({
        where: { id: declarationId },
        data: {
          status: 'SETTLED',
          settlementJournalEntryId: je.id,
          totalOutputVat: new Decimal(output),
          totalInputVat: new Decimal(input),
          netVatAmount: new Decimal(net),
        },
        include: { taxPeriod: true },
      });
    });
  }

  /**
   * Wave 2 fix: reverses a SETTLED VAT declaration back to FINAL. Blocked
   * once an authority payment has been recorded against it — unwind the
   * payment(s) first via `reverseAuthorityPayment`.
   */
  async unpostVatSettlement(ctx: JournalPostingContext, declarationId: string) {
    const declaration = await prisma.taxDeclaration.findFirst({
      where: { id: declarationId, companyId: ctx.companyId },
      include: { taxPeriod: true, settlements: true },
    });
    if (!declaration) throw new AppError(404, 'Tax declaration not found');
    if (declaration.status !== 'SETTLED') {
      throw new AppError(400, 'Declaration is not settled');
    }
    if (declaration.settlements.length > 0) {
      throw new AppError(
        400,
        'Reverse the authority payment(s) recorded against this declaration before unposting the settlement'
      );
    }
    if (declaration.taxPeriod.status === 'CLOSED') {
      throw new AppError(403, 'Cannot unpost VAT settlement for a closed tax period');
    }
    if (!declaration.settlementJournalEntryId) {
      throw new AppError(400, 'Declaration has no settlement journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(
        tx,
        ctx,
        declaration.settlementJournalEntryId!,
        { reason: 'VAT settlement unposted' }
      );

      return tx.taxDeclaration.update({
        where: { id: declarationId },
        data: { status: 'FINAL', settlementJournalEntryId: null },
        include: { taxPeriod: true },
      });
    });
  }

  /**
   * Wave 2 fix: reverses a single authority payment — dated contra entry
   * against the payment JE, restores the safe/bank balance, and deletes the
   * settlement record so the declaration can be re-paid or unposted.
   */
  async reverseAuthorityPayment(ctx: JournalPostingContext, taxSettlementId: string) {
    const settlement = await prisma.taxSettlement.findFirst({
      where: { id: taxSettlementId, companyId: ctx.companyId },
    });
    if (!settlement) throw new AppError(404, 'Tax authority payment not found');
    if (!settlement.paymentJournalEntryId) {
      throw new AppError(400, 'Payment has no journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(
        tx,
        ctx,
        settlement.paymentJournalEntryId!,
        { reason: 'Tax authority payment reversed' }
      );

      if (settlement.safeId) {
        await tx.safe.update({
          where: { id: settlement.safeId },
          data: { balance: { increment: settlement.amount } },
        });
      }
      if (settlement.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: settlement.bankAccountId },
          data: { balance: { increment: settlement.amount } },
        });
      }

      return tx.taxSettlement.delete({ where: { id: taxSettlementId } });
    });
  }

  async payAuthorityViaTreasury(
    ctx: JournalPostingContext,
    declarationId: string,
    params: { amount: number; safeId?: string; bankAccountId?: string; currencyCode?: string }
  ) {
    if (!params.safeId && !params.bankAccountId) {
      throw new AppError(422, 'Safe or bank account is required for tax payment');
    }
    const declaration = await prisma.taxDeclaration.findFirst({
      where: { id: declarationId, companyId: ctx.companyId },
    });
    if (!declaration || declaration.status !== 'SETTLED') {
      throw new AppError(400, 'Declaration must be settled before authority payment');
    }

    const accounts = await this.resolveTaxAccounts(ctx.companyId);
    const amount = roundTo4(params.amount);
    const cashOrBankId = params.safeId
      ? await treasuryAccountResolverService.resolveSafeGlAccountId(ctx.companyId, params.safeId)
      : await treasuryAccountResolverService.resolveBankGlAccountId(
          ctx.companyId,
          params.bankAccountId!
        );

    const lines: JournalEntryLineData[] = [
      {
        accountId: accounts.taxAuthorityAccountId,
        debit: amount,
        credit: 0,
        lineOrder: 1,
        description: 'Pay VAT to tax authority',
      },
      {
        accountId: cashOrBankId,
        debit: 0,
        credit: amount,
        lineOrder: 2,
        description: 'Treasury outflow',
      },
    ];

    const legacyGlNum = await this.allocateGlNum(ctx);
    const fy = await prisma.fiscalYear.findFirst({
      where: { id: ctx.fiscalYearId ?? undefined, companyId: ctx.companyId },
      select: { legacyYearId: true },
    });
    const paySourceYearId = fy?.legacyYearId ?? String(new Date().getUTCFullYear());

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: new Date(),
        description: `Tax authority payment — declaration ${declarationId.slice(0, 8)}`,
        currencyCode: params.currencyCode ?? 'EGP',
        entryType: 'TaxPay',
        sourceType: 'VATPAY',
        sourceNumber: declarationId.slice(0, 8),
        sourceYearId: paySourceYearId,
        lines,
      });

      if (params.safeId) {
        await tx.safe.update({
          where: { id: params.safeId },
          data: { balance: { decrement: new Decimal(amount) } },
        });
      }
      if (params.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: params.bankAccountId },
          data: { balance: { decrement: new Decimal(amount) } },
        });
      }

      return tx.taxSettlement.create({
        data: {
          companyId: ctx.companyId,
          taxDeclarationId: declarationId,
          amount: new Decimal(amount),
          currencyCode: params.currencyCode ?? 'EGP',
          paymentJournalEntryId: je.id,
          safeId: params.safeId,
          bankAccountId: params.bankAccountId,
          settledAt: new Date(),
        },
      });
    });
  }
}

export const taxDeclarationPostingService = new TaxDeclarationPostingService();
