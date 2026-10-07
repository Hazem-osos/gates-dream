import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly } from '../../utils/hr-effective-date.util';

export type LedgerTransactionType =
  | 'OPENING'
  | 'ENTITLEMENT'
  | 'ACCRUAL'
  | 'CARRY_FORWARD'
  | 'ADJUSTMENT_CREDIT'
  | 'ADJUSTMENT_DEBIT'
  | 'LEAVE_TAKEN'
  | 'LEAVE_REVERSAL'
  | 'EXPIRY'
  | 'ENCASHMENT'
  | 'FORFEITURE'
  | 'MIGRATED_OPENING_BALANCE';

const CREDIT_TYPES = new Set<LedgerTransactionType>([
  'OPENING',
  'ENTITLEMENT',
  'ACCRUAL',
  'CARRY_FORWARD',
  'ADJUSTMENT_CREDIT',
  'LEAVE_REVERSAL',
  'MIGRATED_OPENING_BALANCE',
]);

export class LeaveLedgerService {
  isCredit(type: LedgerTransactionType): boolean {
    return CREDIT_TYPES.has(type);
  }

  signedQuantity(type: LedgerTransactionType, quantity: Decimal): Decimal {
    const q = new Decimal(quantity);
    if (type === 'LEAVE_TAKEN' || type === 'ADJUSTMENT_DEBIT' || type === 'EXPIRY' || type === 'FORFEITURE' || type === 'ENCASHMENT') {
      return q.negated();
    }
    return q;
  }

  async postEntry(
    input: {
      companyId: string;
      employmentId: string;
      leaveTypeId: string;
      effectiveDate: Date;
      quantity: Decimal | number | string;
      unit?: string;
      transactionType: LedgerTransactionType;
      sourceKey: string;
      requestId?: string;
      reason?: string;
      createdBy?: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;
    const qty = new Decimal(input.quantity);
    if (qty.lte(0) && input.transactionType !== 'LEAVE_TAKEN') {
      throw new AppError(422, 'Quantity must be positive');
    }
    try {
      return await db.hcmLeaveLedgerEntry.create({
        data: {
          companyId: input.companyId,
          employmentId: input.employmentId,
          leaveTypeId: input.leaveTypeId,
          effectiveDate: toDateOnly(input.effectiveDate),
          quantity: qty,
          unit: input.unit ?? 'DAYS',
          transactionType: input.transactionType,
          sourceKey: input.sourceKey,
          requestId: input.requestId,
          reason: input.reason,
          createdBy: input.createdBy,
        },
      });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2002') {
        return await db.hcmLeaveLedgerEntry.findFirst({
          where: { companyId: input.companyId, sourceKey: input.sourceKey },
        });
      }
      throw e;
    }
  }

  async listEntries(
    companyId: string,
    employmentId: string,
    leaveTypeId: string,
    asOfDate: Date
  ) {
    return prisma.hcmLeaveLedgerEntry.findMany({
      where: {
        companyId,
        employmentId,
        leaveTypeId,
        effectiveDate: { lte: toDateOnly(asOfDate) },
      },
      orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }],
    });
  }
}

export const leaveLedgerService = new LeaveLedgerService();
