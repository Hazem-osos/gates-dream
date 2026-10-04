import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { applyPartnerCardBalancesFromLinesInTx } from '../../accounting/services/ledger-balance.service';
import { ensurePartyCardMatchesLedger } from '../../accounting/services/party-ledger-balance.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { roundTo2 } from '../utils/pos-money';
import type { PosPostingContext } from '../types/pos.types';
import { posAccountResolverService } from './pos-account-resolver.service';
import { loadDrawerEquation } from './pos-drawer';
import { recordPosAudit } from './pos-audit.service';

const DEFAULTS = {
  varianceTolerance: 0,
  varianceRequiresApproval: false,
  discountApprovalPercent: null as number | null,
  priceOverrideRequiresApproval: false,
  returnRequiresApproval: false,
  receiptFooter: null as string | null,
  offlineEnabled: false,
  blindClose: false,
  pointsPerAmount: null as number | null,
  exchangeClearingAccountId: null as string | null,
  storeCreditAccountId: null as string | null,
  giftCardAccountId: null as string | null,
  depositAccountId: null as string | null,
  pointsAccountId: null as string | null,
};

export async function getPosSettings(companyId: string) {
  const row = await prisma.posSettings.findUnique({ where: { companyId } });
  if (!row) return { ...DEFAULTS, companyId, id: null };
  return {
    ...row,
    varianceTolerance: Number(row.varianceTolerance),
    discountApprovalPercent: row.discountApprovalPercent == null ? null : Number(row.discountApprovalPercent),
    pointsPerAmount: row.pointsPerAmount == null ? null : Number(row.pointsPerAmount),
  };
}

export async function savePosSettings(
  companyId: string,
  input: Partial<{
    varianceTolerance: number;
    varianceRequiresApproval: boolean;
    discountApprovalPercent: number | null;
    priceOverrideRequiresApproval: boolean;
    returnRequiresApproval: boolean;
    receiptFooter: string | null;
    offlineEnabled: boolean;
    blindClose: boolean;
    pointsPerAmount: number | null;
    exchangeClearingAccountId: string | null;
    storeCreditAccountId: string | null;
    giftCardAccountId: string | null;
    depositAccountId: string | null;
    pointsAccountId: string | null;
  }>
) {
  const data = {
    varianceTolerance: input.varianceTolerance == null ? undefined : new Decimal(input.varianceTolerance),
    varianceRequiresApproval: input.varianceRequiresApproval,
    discountApprovalPercent:
      input.discountApprovalPercent === undefined
        ? undefined
        : input.discountApprovalPercent == null
          ? null
          : new Decimal(input.discountApprovalPercent),
    priceOverrideRequiresApproval: input.priceOverrideRequiresApproval,
    returnRequiresApproval: input.returnRequiresApproval,
    receiptFooter: input.receiptFooter,
    offlineEnabled: input.offlineEnabled,
    blindClose: input.blindClose,
    pointsPerAmount:
      input.pointsPerAmount === undefined
        ? undefined
        : input.pointsPerAmount == null
          ? null
          : new Decimal(input.pointsPerAmount),
    exchangeClearingAccountId: input.exchangeClearingAccountId,
    storeCreditAccountId: input.storeCreditAccountId,
    giftCardAccountId: input.giftCardAccountId,
    depositAccountId: input.depositAccountId,
    pointsAccountId: input.pointsAccountId,
  };
  return prisma.posSettings.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });
}

export async function assertVariancePolicy(
  companyId: string,
  shiftId: string,
  userId: string,
  variance: number,
  approverIsSupervisor: boolean
) {
  const settings = await getPosSettings(companyId);
  const over = Math.abs(variance) > Number(settings.varianceTolerance) + 0.001;
  if (!settings.varianceRequiresApproval || !over || approverIsSupervisor) return;
  const approval = await prisma.posApproval.findFirst({
    where: {
      companyId,
      shiftId,
      action: 'VARIANCE',
      status: 'APPROVED',
      approverId: { not: userId },
    },
  });
  if (!approval) throw new AppError(422, 'POS variance needs supervisor approval');
}

type ApprovalDb = Prisma.TransactionClient | typeof prisma;

export async function consumeReturnApproval(
  db: ApprovalDb,
  companyId: string,
  orderId: string,
  approvalId: string | undefined,
  _posterUserId: string
) {
  const settings = await db.posSettings.findUnique({ where: { companyId } });
  if (!settings?.returnRequiresApproval) return null;
  if (!approvalId) throw new AppError(403, 'POS return needs supervisor approval');
  const approval = await db.posApproval.findFirst({ where: { id: approvalId, companyId } });
  if (!approval || approval.action !== 'RETURN' || approval.status !== 'APPROVED' || approval.consumedByOrderId) {
    throw new AppError(403, 'POS return approval is not valid');
  }
  if (approval.orderId !== orderId) throw new AppError(403, 'POS return approval does not match this order');
  if (!approval.approverId || approval.approverId === approval.requesterId) {
    throw new AppError(403, 'POS approval needs a different supervisor');
  }
  const grants = await db.userPermission.findMany({
    where: { companyId, userId: approval.approverId, allow: true },
    select: { resource: true, action: true },
  });
  const authorized = grants.some(
    (row) => row.resource === '*' || (row.resource === 'pos' && row.action === 'approve')
  );
  if (!authorized) throw new AppError(403, 'POS return approver is not authorized');
  const consumed = await db.posApproval.updateMany({
    where: { id: approval.id, companyId, status: 'APPROVED', consumedByOrderId: null, orderId },
    data: { status: 'CONSUMED', consumedByOrderId: orderId },
  });
  if (consumed.count !== 1) throw new AppError(409, 'POS return approval was already used');
  return approval;
}

export async function requestPosApproval(
  companyId: string,
  input: { action: string; reason: string; requesterId: string; shiftId?: string; orderId?: string; payload?: unknown }
) {
  if (!input.reason.trim()) throw new AppError(422, 'POS approval needs a reason');
  const row = await prisma.posApproval.create({
    data: {
      companyId,
      action: input.action,
      reason: input.reason.trim(),
      requesterId: input.requesterId,
      shiftId: input.shiftId,
      orderId: input.orderId,
      payload: input.payload as object | undefined,
    },
  });
  await recordPosAudit({
    companyId,
    entityType: input.orderId ? 'POS_ORDER' : 'POS_SHIFT',
    entityId: input.orderId ?? input.shiftId ?? row.id,
    action: 'SUBMITTED',
    userId: input.requesterId,
    shiftId: input.shiftId,
    reason: row.reason,
    detail: { kind: 'approval-request', approvalId: row.id, approvalAction: row.action },
  });
  return row;
}

export async function decidePosApproval(
  companyId: string,
  id: string,
  approverId: string,
  accept: boolean
) {
  const row = await prisma.posApproval.findFirst({ where: { id, companyId } });
  if (!row) throw new AppError(404, 'POS approval not found');
  if (row.status !== 'PENDING') return row;
  if (row.requesterId === approverId) throw new AppError(403, 'POS approval needs a different supervisor');
  const decided = await prisma.posApproval.update({
    where: { id },
    data: { status: accept ? 'APPROVED' : 'REJECTED', approverId, decidedAt: new Date() },
  });
  await recordPosAudit({
    companyId,
    entityType: row.orderId ? 'POS_ORDER' : 'POS_SHIFT',
    entityId: row.orderId ?? row.shiftId ?? row.id,
    action: accept ? 'APPROVED' : 'REJECTED',
    userId: approverId,
    shiftId: row.shiftId,
    reason: row.reason,
    detail: { kind: 'approval-decision', approvalId: row.id, approverId, approvalAction: row.action },
  });
  return decided;
}

export async function listPosApprovals(companyId: string, status?: string) {
  return prisma.posApproval.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function posCreditWorkspace(companyId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId, deletedAt: null },
    select: { id: true, arabicName: true, creditLimit: true, balance: true },
  });
  if (!customer) throw new AppError(404, 'Customer not found');
  const ledger = await ensurePartyCardMatchesLedger(companyId, customerId, 'customer');
  const payments = await prisma.posPayment.findMany({
    where: {
      companyId,
      settlementType: 'CREDIT',
      order: { customerId, status: 'POSTED' },
    },
    include: { order: { select: { id: true, orderNumber: true, postedAt: true, orderType: true, netAmount: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const collections = await prisma.posCreditCollection.findMany({
    where: { companyId, customerId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const limit = customer.creditLimit == null ? null : Number(customer.creditLimit);
  const balance = ledger.balance;
  const cachedBalance = Number(customer.balance);
  return {
    customer: { ...customer, creditLimit: limit, balance, ledgerBalance: balance, cachedBalance },
    availableCredit: limit == null ? null : roundTo2(limit - balance),
    cacheHealed: ledger.healed,
    balanceNote:
      'الرصيد المحاسبي من دفتر الأستاذ (partner_running_balances). كشف الحساب هو المرجع؛ الرصيد المخزن يُحدَّث تلقائياً عند الانحراف.',
    creditSales: payments.map((row) => ({
      orderId: row.order.id,
      orderNumber: row.order.orderNumber,
      postedAt: row.order.postedAt,
      orderType: row.order.orderType,
      amount: Number(row.amount),
    })),
    collections,
  };
}

function collectionReceipt(row: {
  id: string;
  amount: Prisma.Decimal | number;
  clientRequestId: string | null;
  journalEntryId: string | null;
  customerId: string;
  createdAt: Date;
}) {
  return {
    ...row,
    amount: Number(row.amount),
    receipt: {
      title: 'إيصال تحصيل',
      reference: row.clientRequestId,
      amount: Number(row.amount),
      customerId: row.customerId,
      journalEntryId: row.journalEntryId,
      createdAt: row.createdAt,
    },
  };
}

export async function collectPosCredit(
  ctx: PosPostingContext,
  input: { customerId: string; amount: number; safeId: string; shiftId?: string; notes?: string; clientRequestId?: string }
) {
  const clientRequestId = input.clientRequestId?.trim() ?? '';
  if (!clientRequestId || clientRequestId.length > 64) {
    throw new AppError(422, 'Collection needs a stable request key');
  }
  const amount = roundTo2(input.amount);
  if (!(amount > 0)) throw new AppError(422, 'Collection amount must be greater than zero');
  const existing = await prisma.posCreditCollection.findFirst({
    where: { companyId: ctx.companyId, clientRequestId },
  });
  if (existing) {
    if (existing.customerId !== input.customerId) {
      throw new AppError(409, 'Collection key belongs to another customer');
    }
    return collectionReceipt(existing);
  }
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, companyId: ctx.companyId, deletedAt: null },
  });
  if (!customer) throw new AppError(404, 'Customer not found');
  const accounts = await posAccountResolverService.resolveForShiftClose({
    companyId: ctx.companyId,
    safeId: input.safeId,
    bankAccountId: null,
  });
  const cashGl = accounts.cashGlAccountId;
  try {
    const saved = await prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum: await documentSequenceService.nextGlNumberInTx(tx, ctx),
        date: new Date(),
        description: `POS credit collection ${customer.arabicName}`,
        currencyCode: 'EGP',
        entryType: 'POS-COLLECTION',
        sourceType: 'POS-COLLECTION',
        sourceNumber: createHash('sha256').update(clientRequestId).digest('hex').slice(0, 30),
        sourceYearId: String(new Date().getUTCFullYear()),
        lines: [
          { accountId: cashGl, debit: amount, credit: 0, lineOrder: 1, description: 'POS collection cash' },
          {
            accountId: accounts.arAccountId,
            debit: 0,
            credit: amount,
            lineOrder: 2,
            description: 'POS collection receivable',
            partnerId: customer.id,
            partnerType: 'CUSTOMER',
          },
        ],
        skipCardColumns: true,
      });
      await applyPartnerCardBalancesFromLinesInTx(tx, ctx.companyId, [
        {
          accountId: accounts.arAccountId,
          debit: 0,
          credit: amount,
          debitBase: amount,
          creditBase: amount,
          partnerId: customer.id,
          partnerType: 'CUSTOMER',
        },
      ]);
      return tx.posCreditCollection.create({
        data: {
          companyId: ctx.companyId,
          customerId: customer.id,
          shiftId: input.shiftId,
          amount: new Decimal(amount),
          safeId: input.safeId,
          journalEntryId: je.id,
          collectedBy: ctx.userId,
          notes: input.notes,
          clientRequestId,
        },
      });
    });
    return collectionReceipt(saved);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    const winner = await prisma.posCreditCollection.findFirst({
      where: { companyId: ctx.companyId, clientRequestId },
    });
    if (!winner) throw error;
    if (winner.customerId !== input.customerId) {
      throw new AppError(409, 'Collection key belongs to another customer');
    }
    return collectionReceipt(winner);
  }
}

export async function listOpenPosSessions(companyId: string) {
  const shifts = await prisma.posShift.findMany({
    where: { companyId, status: 'OPEN' },
    include: {
      terminal: { select: { id: true, name: true, branchId: true, branch: { select: { arabicName: true } } } },
    },
    orderBy: { openedAt: 'desc' },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: shifts.map((row) => row.userId) } },
    select: { id: true, firstName: true, lastName: true, username: true },
  });
  const byUser = new Map(users.map((row) => [row.id, row]));
  const rows = [];
  for (const shift of shifts) {
    const equation = await loadDrawerEquation(prisma, companyId, shift.id, Number(shift.openingCash));
    const cashier = byUser.get(shift.userId);
    rows.push({
      id: shift.id,
      status: shift.status,
      openedAt: shift.openedAt,
      openingCash: Number(shift.openingCash),
      cashierId: shift.userId,
      cashierName: cashier ? `${cashier.firstName ?? ''} ${cashier.lastName ?? ''}`.trim() || cashier.username : shift.userId,
      terminalId: shift.terminalId,
      terminalName: shift.terminal.name,
      branchId: shift.terminal.branchId,
      branchName: shift.terminal.branch.arabicName,
      expectedCash: equation.expectedCash,
      salesNet: equation.netSales,
      refundsNet: equation.returnsNet,
      cashIn: equation.cashIn,
      cashOut: equation.cashOut,
      variance: null,
    });
  }
  return rows;
}

export async function listPosShiftCloses(companyId: string) {
  return prisma.posShiftClose.findMany({
    where: { companyId },
    orderBy: { closedAt: 'desc' },
    take: 50,
  });
}

export async function listPosAudit(
  companyId: string,
  filters: {
    from?: Date;
    to?: Date;
    userId?: string;
    action?: string;
    terminalId?: string;
    shiftId?: string;
    documentId?: string;
  }
) {
  const rows = await prisma.activityLog.findMany({
    where: {
      tenantId: companyId,
      kind: 'document-audit',
      subjectType: { in: ['POS_ORDER', 'POS_SHIFT'] },
      ...(filters.userId ? { actorId: filters.userId } : {}),
      ...(filters.documentId ? { subjectId: filters.documentId } : {}),
      ...(filters.from || filters.to ? { at: { gte: filters.from, lte: filters.to } } : {}),
    },
    orderBy: { at: 'desc' },
    take: 400,
  });
  return rows.filter((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (filters.action && meta.action !== filters.action && meta.approvalAction !== filters.action) return false;
    if (filters.terminalId && meta.terminalId !== filters.terminalId) return false;
    if (filters.shiftId && meta.shiftId !== filters.shiftId) return false;
    return true;
  });
}
