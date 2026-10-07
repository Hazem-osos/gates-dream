import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { leaveLedgerService, type LedgerTransactionType } from './leave-ledger.service';

export type LeaveBalanceBreakdown = {
  employmentId: string;
  leaveTypeId: string;
  asOfDate: string;
  unit: string;
  opening: string;
  entitled: string;
  accrued: string;
  carriedForward: string;
  adjustments: string;
  taken: string;
  expired: string;
  encashed: string;
  forfeited: string;
  ledgerNet: string;
  reserved: string;
  available: string;
  pendingRequests: number;
};

export class LeaveBalanceService {
  async getReservedQuantity(
    companyId: string,
    employmentId: string,
    leaveTypeId: string,
    asOfDate: Date
  ): Promise<Decimal> {
    const asOf = toDateOnly(asOfDate);
    const requests = await prisma.hcmLeaveRequest.findMany({
      where: {
        companyId,
        employmentId,
        leaveTypeId,
        status: { in: ['SUBMITTED', 'APPROVED'] },
        startDate: { lte: asOf },
      },
      select: { id: true, calculatedQuantity: true, requestedQuantity: true, status: true },
    });
    let reserved = new Decimal(0);
    for (const r of requests) {
      const taken = await prisma.hcmLeaveLedgerEntry.count({
        where: { companyId, requestId: r.id, transactionType: 'LEAVE_TAKEN' },
      });
      if (taken > 0) continue;
      const q = r.calculatedQuantity ?? r.requestedQuantity;
      reserved = reserved.plus(q);
    }
    return reserved;
  }

  async getLeaveBalance(
    companyId: string,
    employmentId: string,
    leaveTypeId: string,
    asOfDate: Date
  ): Promise<LeaveBalanceBreakdown> {
    const asOf = toDateOnly(asOfDate);
    const entries = await leaveLedgerService.listEntries(companyId, employmentId, leaveTypeId, asOf);

    const buckets: Record<string, Decimal> = {
      opening: new Decimal(0),
      entitled: new Decimal(0),
      accrued: new Decimal(0),
      carriedForward: new Decimal(0),
      adjustments: new Decimal(0),
      taken: new Decimal(0),
      expired: new Decimal(0),
      encashed: new Decimal(0),
      forfeited: new Decimal(0),
    };

    let unit = 'DAYS';
    for (const e of entries) {
      unit = e.unit;
      const signed = leaveLedgerService.signedQuantity(e.transactionType as LedgerTransactionType, e.quantity);
      const t = e.transactionType as LedgerTransactionType;
      if (t === 'OPENING' || t === 'MIGRATED_OPENING_BALANCE') buckets.opening = buckets.opening.plus(signed);
      else if (t === 'ENTITLEMENT') buckets.entitled = buckets.entitled.plus(signed);
      else if (t === 'ACCRUAL') buckets.accrued = buckets.accrued.plus(signed);
      else if (t === 'CARRY_FORWARD') buckets.carriedForward = buckets.carriedForward.plus(signed);
      else if (t === 'ADJUSTMENT_CREDIT' || t === 'ADJUSTMENT_DEBIT')
        buckets.adjustments = buckets.adjustments.plus(signed);
      else if (t === 'LEAVE_TAKEN' || t === 'LEAVE_REVERSAL') buckets.taken = buckets.taken.plus(signed.negated());
      else if (t === 'EXPIRY') buckets.expired = buckets.expired.plus(e.quantity);
      else if (t === 'ENCASHMENT') buckets.encashed = buckets.encashed.plus(e.quantity);
      else if (t === 'FORFEITURE') buckets.forfeited = buckets.forfeited.plus(e.quantity);
    }

    const ledgerNet = entries.reduce(
      (sum, e) => sum.plus(leaveLedgerService.signedQuantity(e.transactionType as LedgerTransactionType, e.quantity)),
      new Decimal(0)
    );

    const reserved = await this.getReservedQuantity(companyId, employmentId, leaveTypeId, asOf);
    const available = ledgerNet.minus(reserved);

    const pendingRequests = await prisma.hcmLeaveRequest.count({
      where: { companyId, employmentId, leaveTypeId, status: 'SUBMITTED' },
    });

    const fmt = (d: Decimal) => d.toFixed(4);
    return {
      employmentId,
      leaveTypeId,
      asOfDate: asOf.toISOString().slice(0, 10),
      unit,
      opening: fmt(buckets.opening),
      entitled: fmt(buckets.entitled),
      accrued: fmt(buckets.accrued),
      carriedForward: fmt(buckets.carriedForward),
      adjustments: fmt(buckets.adjustments),
      taken: fmt(buckets.taken),
      expired: fmt(buckets.expired),
      encashed: fmt(buckets.encashed),
      forfeited: fmt(buckets.forfeited),
      ledgerNet: fmt(ledgerNet),
      reserved: fmt(reserved),
      available: fmt(available),
      pendingRequests,
    };
  }
}

export const leaveBalanceService = new LeaveBalanceService();
