import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { roundTo2 } from '../utils/pos-money';
import { recordPosAudit } from './pos-audit.service';
import { lockShiftRow, assertShiftOpen } from './pos-drawer';
import type { PosPostingContext } from '../types/pos.types';

/**
 * Drawer cash that is not a sale. The contra account must already exist
 * on the company chart. customer.balance is not touched here.
 */
export class PosCashMovementService {
  async record(
    ctx: PosPostingContext,
    input: { shiftId: string; type: 'CASH_IN' | 'CASH_OUT'; amount: number; reason: string; contraAccountId: string }
  ) {
    const amount = roundTo2(input.amount);
    if (amount <= 0) throw new AppError(422, 'Cash movement amount must be greater than zero');
    const reason = input.reason.trim();
    if (!reason) throw new AppError(422, 'Cash movement reason is required');
    if (input.type !== 'CASH_IN' && input.type !== 'CASH_OUT') {
      throw new AppError(422, 'Unknown cash movement type');
    }

    const shift = await prisma.posShift.findFirst({
      where: { id: input.shiftId, companyId: ctx.companyId },
      include: { terminal: true },
    });
    if (!shift) throw new AppError(404, 'POS shift not found');
    assertShiftOpen(shift.status);

    const contraAccountId = await invoiceAccountResolverService.resolveAccountId(
      ctx.companyId,
      input.contraAccountId
    );
    const safeGl = await treasuryAccountResolverService.resolveSafeGlAccountId(
      ctx.companyId,
      shift.terminal.safeId
    );
    const fy = await prisma.fiscalYear.findFirst({
      where: { id: ctx.fiscalYearId, companyId: ctx.companyId },
      select: { legacyYearId: true },
    });
    const sourceYearId = fy?.legacyYearId ?? String(new Date().getUTCFullYear());

    const saved = await prisma.$transaction(async (tx) => {
      const locked = await lockShiftRow(tx, ctx.companyId, shift.id);
      assertShiftOpen(locked?.status);

      const movement = await tx.posCashMovement.create({
        data: {
          companyId: ctx.companyId,
          shiftId: shift.id,
          terminalId: shift.terminalId,
          type: input.type,
          amount: new Decimal(amount),
          reason,
          userId: ctx.userId,
          contraAccountId,
          safeId: shift.terminal.safeId,
        },
      });

      const cashDebit = input.type === 'CASH_IN' ? amount : 0;
      const cashCredit = input.type === 'CASH_OUT' ? amount : 0;
      const legacyGlNum = await documentSequenceService.nextGlNumberInTx(tx, ctx);
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: new Date(),
        description: `POS ${input.type === 'CASH_IN' ? 'cash in' : 'cash out'}: ${reason}`,
        currencyCode: 'EGP',
        entryType: input.type === 'CASH_IN' ? 'POS-CASH-IN' : 'POS-CASH-OUT',
        sourceType: 'POS-CASH',
        sourceNumber: movement.id.slice(0, 12),
        sourceYearId,
        lines: [
          {
            accountId: safeGl,
            debit: cashDebit,
            credit: cashCredit,
            lineOrder: 1,
            description: input.type === 'CASH_IN' ? 'POS cash in' : 'POS cash out',
          },
          {
            accountId: contraAccountId,
            debit: cashCredit,
            credit: cashDebit,
            lineOrder: 2,
            description: reason,
          },
        ],
      });

      return tx.posCashMovement.update({
        where: { id: movement.id },
        data: { journalEntryId: je.id },
      });
    });
    await recordPosAudit({
      companyId: ctx.companyId,
      entityType: 'POS_SHIFT',
      entityId: shift.id,
      action: input.type === 'CASH_IN' ? 'CASH_IN' : 'CASH_OUT',
      userId: ctx.userId,
      terminalId: shift.terminalId,
      shiftId: shift.id,
      reason: input.reason,
      after: { amount: input.amount, contraAccountId: input.contraAccountId },
    });
    return saved;
  }
}

export const posCashMovementService = new PosCashMovementService();
