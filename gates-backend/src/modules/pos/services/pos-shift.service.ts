import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { taxPeriodService } from '../../taxes/services/tax-period.service';
import { posAccountResolverService } from './pos-account-resolver.service';
import type { PosPostingContext, ZReportSummary } from '../types/pos.types';

export class PosShiftService {
  async openShift(
    ctx: PosPostingContext,
    params: { terminalId: string; openingCash: number; shiftNumber?: string }
  ) {
    const terminal = await prisma.posTerminal.findFirst({
      where: { id: params.terminalId, companyId: ctx.companyId, isActive: true },
    });
    if (!terminal) throw new AppError(404, 'POS terminal not found');

    const existing = await prisma.posShift.findFirst({
      where: {
        companyId: ctx.companyId,
        terminalId: params.terminalId,
        status: 'OPEN',
      },
    });
    if (existing) {
      throw new AppError(400, 'An open shift already exists on this terminal');
    }

    return prisma.posShift.create({
      data: {
        companyId: ctx.companyId,
        branchId: terminal.branchId,
        fiscalYearId: ctx.fiscalYearId,
        terminalId: params.terminalId,
        userId: ctx.userId,
        shiftNumber: params.shiftNumber,
        openingCash: new Decimal(params.openingCash),
        status: 'OPEN',
      },
    });
  }

  async getShift(companyId: string, shiftId: string) {
    const shift = await prisma.posShift.findFirst({
      where: { id: shiftId, companyId },
      include: { terminal: true, orders: { where: { status: 'POSTED' } } },
    });
    if (!shift) throw new AppError(404, 'POS shift not found');
    return shift;
  }

  async getOpenShiftForTerminal(companyId: string, terminalId: string) {
    return prisma.posShift.findFirst({
      where: {
        companyId,
        terminalId,
        status: 'OPEN',
      },
      include: {
        terminal: true,
        orders: { where: { status: 'POSTED' }, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  buildZReport(shift: {
    id: string;
    openingCash: Decimal;
    closingCashSystem: Decimal | null;
    closingCashDeclared: Decimal | null;
    cashVariance: Decimal | null;
    totalCashSales: Decimal;
    totalCardSales: Decimal;
    totalCreditSales: Decimal;
    totalMerchandise: Decimal;
    totalTaxAmount: Decimal;
    totalCogs: Decimal;
    orders: unknown[];
  }): ZReportSummary {
    return {
      shiftId: shift.id,
      openingCash: Number(shift.openingCash),
      closingCashSystem: Number(shift.closingCashSystem ?? 0),
      closingCashDeclared: Number(shift.closingCashDeclared ?? 0),
      cashVariance: Number(shift.cashVariance ?? 0),
      totalCashSales: Number(shift.totalCashSales),
      totalCardSales: Number(shift.totalCardSales),
      totalCreditSales: Number(shift.totalCreditSales),
      totalMerchandise: Number(shift.totalMerchandise),
      totalTaxAmount: Number(shift.totalTaxAmount),
      totalCogs: Number(shift.totalCogs),
      orderCount: shift.orders.length,
    };
  }

  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  /**
   * C10 fix: revenue/VAT/COGS/inventory/tender for every order are now
   * posted at `pos-order-posting.service.ts#postOrder` time, immediately.
   * Closing a shift is therefore no longer a revenue-recognition act — it is
   * purely a cash-drawer reconciliation. The only journal entry that can
   * come out of this is a shortage/surplus adjustment, and only if the
   * declared cash count doesn't match what the (already-posted) orders say
   * should be in the drawer. A shift with zero variance closes with no JE.
   */
  async closeShift(
    ctx: PosPostingContext,
    shiftId: string,
    closingCashDeclared: number
  ) {
    const shift = await this.getShift(ctx.companyId, shiftId);
    if (shift.status !== 'OPEN') throw new AppError(400, 'Shift is not open');
    if (shift.orders.length === 0) {
      throw new AppError(422, 'Cannot close shift with no posted orders');
    }

    await taxPeriodService.assertOpenForDocumentDate(ctx.companyId, new Date());

    const cashNet = roundTo4(Number(shift.totalCashSales));
    const closingCashSystem = roundTo4(Number(shift.openingCash) + cashNet);
    const cashVariance = roundTo4(closingCashDeclared - closingCashSystem);
    const hasVariance = Math.abs(cashVariance) > 0.0001;

    let accounts: Awaited<ReturnType<typeof posAccountResolverService.resolveForShiftClose>> | null =
      null;
    let sourceYearId: string | undefined;
    let legacyGlNum: string | undefined;
    if (hasVariance) {
      accounts = await posAccountResolverService.resolveForShiftClose({
        companyId: ctx.companyId,
        safeId: shift.terminal.safeId,
        bankAccountId: shift.terminal.bankAccountId,
      });
      if (cashVariance < 0 && !accounts.cashShortageAccountId) {
        throw new AppError(422, 'Cash shortage account is not configured');
      }
      if (cashVariance > 0 && !accounts.cashSurplusAccountId) {
        throw new AppError(422, 'Cash surplus account is not configured');
      }
      legacyGlNum = await this.allocateGlNum(ctx);
      const fy = await prisma.fiscalYear.findFirst({
        where: { id: ctx.fiscalYearId, companyId: ctx.companyId },
        select: { legacyYearId: true },
      });
      sourceYearId = fy?.legacyYearId ?? String(new Date().getUTCFullYear());
    }

    return prisma.$transaction(async (tx) => {
      let journalEntryId: string | undefined;

      if (hasVariance && accounts) {
        const lines: JournalEntryLineData[] = [];
        let lineOrder = 1;

        if (cashVariance < 0) {
          lines.push({
            accountId: accounts.cashShortageAccountId!,
            debit: Math.abs(cashVariance),
            credit: 0,
            lineOrder: lineOrder++,
            description: 'Cash shortage',
          });
          lines.push({
            accountId: accounts.cashGlAccountId,
            debit: 0,
            credit: Math.abs(cashVariance),
            lineOrder: lineOrder++,
            description: 'Drawer count adjustment',
          });
        } else {
          lines.push({
            accountId: accounts.cashGlAccountId,
            debit: cashVariance,
            credit: 0,
            lineOrder: lineOrder++,
            description: 'Drawer count adjustment',
          });
          lines.push({
            accountId: accounts.cashSurplusAccountId!,
            debit: 0,
            credit: cashVariance,
            lineOrder: lineOrder++,
            description: 'Cash surplus',
          });
        }

        const je = await journalPostingService.createAndPostInTx(tx, ctx, {
          fiscalYearId: ctx.fiscalYearId!,
          legacyGlNum,
          date: new Date(),
          description: `POS shift ${shift.shiftNumber ?? shift.id.slice(0, 8)} cash variance`,
          currencyCode: 'EGP',
          entryType: 'POS-Z',
          sourceType: 'POS-VARIANCE',
          sourceNumber: shift.shiftNumber ?? shift.id.slice(0, 8),
          sourceYearId: sourceYearId!,
          lines,
        });
        journalEntryId = je.id;

        // The variance itself changes what's physically in the drawer to
        // match the declared count — the safe balance corrects to reality.
        await tx.safe.update({
          where: { id: shift.terminal.safeId },
          data: { balance: { increment: new Decimal(cashVariance) } },
        });
      }

      const updated = await tx.posShift.update({
        where: { id: shiftId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closingCashDeclared: new Decimal(closingCashDeclared),
          closingCashSystem: new Decimal(closingCashSystem),
          cashVariance: new Decimal(cashVariance),
          endOfDayJournalEntryId: journalEntryId,
        },
        include: { orders: { where: { status: 'POSTED' } }, terminal: true },
      });

      return {
        shift: updated,
        zReport: this.buildZReport(updated),
        journalEntryId,
      };
    });
  }

  /**
   * Wave 2 fix: reverses a CLOSED shift — dated contra entry against the
   * cash-variance JE (if one exists) and restores the drawer balance, then
   * reopens the shift as OPEN. Previously the only guidance was to "reverse
   * the end-of-day journal entry manually" (`batch-operations.service.ts`);
   * this gives that a real, safe implementation.
   */
  async reopenShift(ctx: PosPostingContext, shiftId: string) {
    const shift = await prisma.posShift.findFirst({
      where: { id: shiftId, companyId: ctx.companyId },
      include: { terminal: true },
    });
    if (!shift) throw new AppError(404, 'POS shift not found');
    if (shift.status !== 'CLOSED') throw new AppError(400, 'Shift is not closed');

    return prisma.$transaction(async (tx) => {
      if (shift.endOfDayJournalEntryId) {
        await journalPostingService.reverseJournalEntryInTx(tx, ctx, shift.endOfDayJournalEntryId, {
          reason: 'POS shift close unposted',
        });
        const variance = Number(shift.cashVariance ?? 0);
        if (variance !== 0) {
          await tx.safe.update({
            where: { id: shift.terminal.safeId },
            data: { balance: { increment: new Decimal(-variance) } },
          });
        }
      }

      return tx.posShift.update({
        where: { id: shiftId },
        data: {
          status: 'OPEN',
          closedAt: null,
          closingCashDeclared: null,
          closingCashSystem: null,
          cashVariance: null,
          endOfDayJournalEntryId: null,
        },
      });
    });
  }
}

export const posShiftService = new PosShiftService();
