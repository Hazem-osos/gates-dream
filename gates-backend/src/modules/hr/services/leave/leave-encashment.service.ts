import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { leaveLedgerService } from './leave-ledger.service';
import { leaveBalanceService } from './leave-balance.service';

export class LeaveEncashmentService {
  async encash(
    companyId: string,
    input: {
      employmentId: string;
      leaveTypeId: string;
      quantity: Decimal | number | string;
      effectiveDate: Date;
      reason?: string;
      createdBy?: string;
    }
  ) {
    const qty = new Decimal(input.quantity);
    const bal = await leaveBalanceService.getLeaveBalance(
      companyId,
      input.employmentId,
      input.leaveTypeId,
      input.effectiveDate
    );
    if (new Decimal(bal.available).lt(qty)) {
      throw new AppError(422, 'Insufficient balance for encashment');
    }
    const sourceKey = `encash:${input.employmentId}:${input.leaveTypeId}:${input.effectiveDate.toISOString().slice(0, 10)}:${Date.now()}`;
    return leaveLedgerService.postEntry({
      companyId,
      employmentId: input.employmentId,
      leaveTypeId: input.leaveTypeId,
      effectiveDate: input.effectiveDate,
      quantity: qty,
      transactionType: 'ENCASHMENT',
      sourceKey,
      reason: input.reason ?? 'Leave encashment',
      createdBy: input.createdBy,
    });
  }

  async reverse(companyId: string, ledgerEntryId: string, userId?: string) {
    const row = await prisma.hcmLeaveLedgerEntry.findFirst({
      where: { id: ledgerEntryId, companyId, transactionType: 'ENCASHMENT' },
    });
    if (!row) throw new AppError(404, 'Encashment entry not found');
    const sourceKey = `encash_rev:${row.id}`;
    return leaveLedgerService.postEntry({
      companyId,
      employmentId: row.employmentId,
      leaveTypeId: row.leaveTypeId,
      effectiveDate: row.effectiveDate,
      quantity: row.quantity,
      transactionType: 'ADJUSTMENT_CREDIT',
      sourceKey,
      reason: 'Encashment reversed before settlement',
      createdBy: userId,
    });
  }
}

export const leaveEncashmentService = new LeaveEncashmentService();
