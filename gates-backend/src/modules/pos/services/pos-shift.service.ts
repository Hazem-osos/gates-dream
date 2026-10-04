import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
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
import { loadDrawerEquation, lockShiftRow } from './pos-drawer';
import { roundTo2 } from '../utils/pos-money';
import { recordPosAudit } from './pos-audit.service';
import { assertVariancePolicy } from './pos-workspace.service';
import { countedFromDenominations } from './pos-commercial-math';
import type { PosPostingContext, ZReportSummary } from '../types/pos.types';

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

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

    try {
      const opened = await prisma.posShift.create({
        data: {
          companyId: ctx.companyId,
          branchId: terminal.branchId,
          fiscalYearId: ctx.fiscalYearId,
          terminalId: params.terminalId,
          userId: ctx.userId,
          shiftNumber: params.shiftNumber,
          openingCash: new Decimal(params.openingCash),
          status: 'OPEN',
          openTerminalKey: params.terminalId,
        },
      });
      await recordPosAudit({
        companyId: ctx.companyId,
        entityType: 'POS_SHIFT',
        entityId: opened.id,
        action: 'OPENED',
        userId: ctx.userId,
        terminalId: params.terminalId,
        shiftId: opened.id,
        after: { openingCash: params.openingCash },
      });
      return opened;
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new AppError(400, 'An open shift already exists on this terminal');
      }
      throw error;
    }
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
   * Drawer reconciliation only. Expected cash is opening cash plus cash
   * sales, minus cash refunds, plus cash in, minus cash out. Change is not
   * included because payment `amount` is the net cash kept in the drawer.
   */
  async reconciliation(companyId: string, shiftId: string) {
    const shift = await this.getShift(companyId, shiftId);
    const equation = await prisma.$transaction((tx) =>
      loadDrawerEquation(tx, companyId, shiftId, Number(shift.openingCash))
    );
    const snapshot = await prisma.posShiftClose.findFirst({
      where: { companyId, shiftId, reopenedAt: null },
      orderBy: { closedAt: 'desc' },
    });
    const varianceAccounts = await posAccountResolverService.varianceAccountReadiness(companyId);
    return { shift, equation, snapshot, varianceAccounts };
  }

  async closeShift(
    ctx: PosPostingContext,
    shiftId: string,
    closingCashDeclared: number,
    options?: { approverIsSupervisor?: boolean; denominations?: Array<{ value: number; count: number }> }
  ) {
    let counted = roundTo2(closingCashDeclared);
    if (options?.denominations?.length) {
      try {
        counted = countedFromDenominations(options.denominations);
      } catch (error) {
        throw new AppError(422, error instanceof Error ? error.message : 'Invalid denominations');
      }
    }
    const shift = await prisma.posShift.findFirst({
      where: { id: shiftId, companyId: ctx.companyId },
      include: { terminal: true },
    });
    if (!shift) throw new AppError(404, 'POS shift not found');
    if (shift.status === 'CLOSED') return this.repeatClose(ctx.companyId, shift, counted);

    await taxPeriodService.assertOpenForDocumentDate(ctx.companyId, new Date());

    const closed = await prisma.$transaction(async (tx) => {
      const locked = await lockShiftRow(tx, ctx.companyId, shiftId);
      if (!locked) throw new AppError(404, 'POS shift not found');
      if (locked.status === 'CLOSED') {
        const current = await tx.posShift.findFirstOrThrow({
          where: { id: shiftId, companyId: ctx.companyId },
          include: { terminal: true },
        });
        if (Math.abs(Number(current.closingCashDeclared ?? 0) - counted) > 0.001) {
          throw new AppError(400, 'Shift is already closed');
        }
        const snapshot = await tx.posShiftClose.findFirst({
          where: { companyId: ctx.companyId, shiftId, reopenedAt: null },
          orderBy: { closedAt: 'desc' },
        });
        return { shift: current, snapshot, journalEntryId: current.endOfDayJournalEntryId, equation: null };
      }
      if (locked.status !== 'OPEN') throw new AppError(400, 'Shift is not open');

      const equation = await loadDrawerEquation(tx, ctx.companyId, shiftId, Number(shift.openingCash));
      const variance = roundTo2(counted - equation.expectedCash);
      await assertVariancePolicy(
        ctx.companyId,
        shiftId,
        ctx.userId,
        variance,
        Boolean(options?.approverIsSupervisor)
      );
      const hasVariance = Math.abs(variance) > 0.001;
      let journalEntryId: string | undefined;

      if (hasVariance) {
        const accounts = await posAccountResolverService.resolveForShiftClose({
          companyId: ctx.companyId,
          safeId: shift.terminal.safeId,
          bankAccountId: shift.terminal.bankAccountId,
        });
        if (variance < 0 && !accounts.cashShortageAccountId) {
          throw new AppError(422, 'Cash shortage account is not configured');
        }
        if (variance > 0 && !accounts.cashSurplusAccountId) {
          throw new AppError(422, 'Cash surplus account is not configured');
        }
        const fy = await tx.fiscalYear.findFirst({
          where: { id: ctx.fiscalYearId, companyId: ctx.companyId },
          select: { legacyYearId: true },
        });
        const lines: JournalEntryLineData[] = [];
        if (variance < 0) {
          lines.push(
            { accountId: accounts.cashShortageAccountId!, debit: Math.abs(variance), credit: 0, lineOrder: 1, description: 'Cash shortage' },
            { accountId: accounts.cashGlAccountId, debit: 0, credit: Math.abs(variance), lineOrder: 2, description: 'Drawer count adjustment' }
          );
        } else {
          lines.push(
            { accountId: accounts.cashGlAccountId, debit: variance, credit: 0, lineOrder: 1, description: 'Drawer count adjustment' },
            { accountId: accounts.cashSurplusAccountId!, debit: 0, credit: variance, lineOrder: 2, description: 'Cash surplus' }
          );
        }
        const je = await journalPostingService.createAndPostInTx(tx, ctx, {
          fiscalYearId: ctx.fiscalYearId!,
          legacyGlNum: await documentSequenceService.nextGlNumberInTx(tx, ctx),
          date: new Date(),
          description: `POS shift ${shift.shiftNumber ?? shift.id.slice(0, 8)} cash variance`,
          currencyCode: 'EGP',
          entryType: 'POS-Z',
          sourceType: 'POS-VARIANCE',
          sourceNumber: shift.id.slice(0, 12),
          sourceYearId: fy?.legacyYearId ?? String(new Date().getUTCFullYear()),
          lines,
        });
        journalEntryId = je.id;
      }

      const closedAt = new Date();
      await tx.posShift.update({
        where: { id: shiftId },
        data: {
          status: 'CLOSED',
          closedAt,
          closingCashDeclared: new Decimal(counted),
          closingCashSystem: new Decimal(equation.expectedCash),
          cashVariance: new Decimal(variance),
          openTerminalKey: null,
          endOfDayJournalEntryId: journalEntryId ?? null,
        },
      });
      const snapshot = await tx.posShiftClose.create({
        data: {
          companyId: ctx.companyId,
          shiftId,
          terminalId: shift.terminalId,
          terminalName: shift.terminal.name,
          cashierId: ctx.userId,
          openedAt: shift.openedAt,
          closedAt,
          openingCash: new Decimal(equation.openingCash),
          grossSales: new Decimal(equation.grossSales),
          netSales: new Decimal(equation.netSales),
          returnsNet: new Decimal(equation.returnsNet),
          cashSales: new Decimal(equation.cashSales),
          cashRefunds: new Decimal(equation.cashRefunds),
          cashIn: new Decimal(equation.cashIn),
          cashOut: new Decimal(equation.cashOut),
          expectedCash: new Decimal(equation.expectedCash),
          countedCash: new Decimal(counted),
          variance: new Decimal(variance),
          orderCount: equation.orderCount,
          returnCount: equation.returnCount,
          paymentBreakdown: equation.paymentBreakdown,
          denominations: options?.denominations ?? undefined,
          journalEntryId: journalEntryId ?? null,
        },
      });
      const updated = await tx.posShift.findFirstOrThrow({
        where: { id: shiftId, companyId: ctx.companyId },
        include: { orders: { where: { status: 'POSTED' } }, terminal: true },
      });
      return { shift: updated, snapshot, journalEntryId, equation, zReport: this.buildZReport(updated) };
    });
    await recordPosAudit({
      companyId: ctx.companyId,
      entityType: 'POS_SHIFT',
      entityId: shiftId,
      action: 'CLOSED',
      userId: ctx.userId,
      terminalId: closed.shift.terminalId,
      shiftId,
      after: {
        countedCash: Number(closed.snapshot?.countedCash ?? 0),
        expectedCash: Number(closed.snapshot?.expectedCash ?? 0),
        variance: Number(closed.snapshot?.variance ?? 0),
      },
      detail: { kind: 'variance' },
    });
    return closed;
  }

  private async repeatClose(
    companyId: string,
    shift: { id: string; closingCashDeclared: Decimal | null; endOfDayJournalEntryId: string | null },
    counted: number
  ) {
    if (Math.abs(Number(shift.closingCashDeclared ?? 0) - counted) > 0.001) {
      throw new AppError(400, 'Shift is already closed');
    }
    const snapshot = await prisma.posShiftClose.findFirst({
      where: { companyId, shiftId: shift.id, reopenedAt: null },
      orderBy: { closedAt: 'desc' },
    });
    const current = await prisma.posShift.findFirstOrThrow({
      where: { id: shift.id, companyId },
      include: { orders: { where: { status: 'POSTED' } }, terminal: true },
    });
    return {
      shift: current,
      snapshot,
      journalEntryId: shift.endOfDayJournalEntryId,
      equation: null,
      zReport: this.buildZReport(current),
    };
  }

  /**
   * Undoes a close: the variance journal is unposted once, the snapshot is
   * marked reopened and kept, and the session becomes OPEN again. A second
   * close writes a new snapshot. Reopen fails when this terminal already
   * has another open session.
   */
  async reopenShift(ctx: PosPostingContext, shiftId: string) {
    const shift = await prisma.posShift.findFirst({
      where: { id: shiftId, companyId: ctx.companyId },
      include: { terminal: true },
    });
    if (!shift) throw new AppError(404, 'POS shift not found');
    if (shift.status !== 'CLOSED') throw new AppError(400, 'Shift is not closed');

    try {
      const reopened = await prisma.$transaction(async (tx) => {
        const locked = await lockShiftRow(tx, ctx.companyId, shiftId);
        if (!locked || locked.status !== 'CLOSED') throw new AppError(400, 'Shift is not closed');
        const current = await tx.posShift.findFirstOrThrow({
          where: { id: shiftId, companyId: ctx.companyId },
          select: { endOfDayJournalEntryId: true },
        });
        if (current.endOfDayJournalEntryId) {
          await journalPostingService.reverseJournalEntryInTx(tx, ctx, current.endOfDayJournalEntryId, {
            reason: 'POS shift close unposted',
          });
        }
        await tx.posShiftClose.updateMany({
          where: { companyId: ctx.companyId, shiftId, reopenedAt: null },
          data: { reopenedAt: new Date() },
        });

        const claimOpen = await tx.posShift.updateMany({
          where: { id: shiftId, companyId: ctx.companyId, status: 'CLOSED' },
          data: {
            status: 'OPEN',
            closedAt: null,
            closingCashDeclared: null,
            closingCashSystem: null,
            cashVariance: null,
            endOfDayJournalEntryId: null,
            openTerminalKey: shift.terminalId,
          },
        });
        if (claimOpen.count !== 1) throw new AppError(400, 'Shift is not closed');

        return tx.posShift.findFirstOrThrow({ where: { id: shiftId, companyId: ctx.companyId } });
      });
      await recordPosAudit({
        companyId: ctx.companyId,
        entityType: 'POS_SHIFT',
        entityId: shiftId,
        action: 'REOPENED',
        userId: ctx.userId,
        terminalId: shift.terminalId,
        shiftId,
        reason: 'shift reopened',
      });
      return reopened;
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new AppError(400, 'An open shift already exists on this terminal');
      }
      throw error;
    }
  }
}

export const posShiftService = new PosShiftService();
