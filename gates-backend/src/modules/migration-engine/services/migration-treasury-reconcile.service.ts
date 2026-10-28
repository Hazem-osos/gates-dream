import type { MigrationContext } from '../migration-context';
import { money2 } from '../accounting/journal-money';
import { Prisma } from '@prisma/client';

export type SettlementReconcileResult = {
  migratedInvoicesWithAllocations: number;
  invoicePaidMismatchCount: number;
  duplicateAllocationGroups: number;
  orphanAllocationCount: number;
  sampleMismatches: { invoiceId: string; invoiceNumber: string; legacyPaid: string; allocationSum: string }[];
};

export type ChequeReconcileResult = {
  migratedCheques: number;
  chequesMissingJournalLink: number;
  chequesByStatus: Record<string, number>;
};

export async function reconcileSettlementHistorical(ctx: MigrationContext): Promise<SettlementReconcileResult> {
  const maps = await ctx.prisma.migrationIdMap.findMany({
    where: {
      migrationJobId: ctx.migrationJobId,
      targetModel: 'PaymentAllocation',
      outcome: { in: ['CREATED_BY_MIGRATION', 'ALREADY_MAPPED'] },
    },
    select: { targetId: true },
  });
  const allocationIds = [...new Set(maps.map((m) => m.targetId))];

  const invoiceMaps = await ctx.prisma.migrationIdMap.findMany({
    where: { migrationJobId: ctx.migrationJobId, targetModel: 'Invoice' },
    select: { targetId: true },
  });
  const invoiceIds = invoiceMaps.map((m) => m.targetId);

  const cashMaps = await ctx.prisma.migrationIdMap.findMany({
    where: { migrationJobId: ctx.migrationJobId, targetModel: 'CashTransaction' },
    select: { targetId: true },
  });
  const cashIds = new Set(cashMaps.map((m) => m.targetId));
  const invoiceIdSet = new Set(invoiceIds);

  let orphanAllocationCount = 0;
  if (allocationIds.length) {
    const rows = await ctx.prisma.paymentAllocation.findMany({
      where: { id: { in: allocationIds }, companyId: ctx.targetCompanyId },
      select: { cashTransactionId: true, invoiceId: true },
    });
    orphanAllocationCount = rows.filter(
      (r) => !cashIds.has(r.cashTransactionId) || !invoiceIdSet.has(r.invoiceId)
    ).length;
  }

  // A voucher may allocate the same amount to the same invoice on two legacy lines; each such
  // row is owned by its own CashTrxDetail mapping. A duplicate is a repeated (invoice, cash,
  // amount) row that no source line of this job owns, or two source lines sharing one row.
  const repeatedGroups = await ctx.prisma.$queryRaw<{ invoiceId: string; cashTransactionId: string; allocatedAmount: Prisma.Decimal }[]>`
    SELECT invoiceId, cashTransactionId, allocatedAmount
    FROM payment_allocations
    WHERE companyId = ${ctx.targetCompanyId}
    GROUP BY invoiceId, cashTransactionId, allocatedAmount
    HAVING COUNT(*) > 1
  `;
  const ownedAllocationIds = new Set(allocationIds);
  let duplicateGroupCount = 0;
  for (const g of repeatedGroups) {
    const rows = await ctx.prisma.paymentAllocation.findMany({
      where: {
        companyId: ctx.targetCompanyId,
        invoiceId: g.invoiceId,
        cashTransactionId: g.cashTransactionId,
        allocatedAmount: g.allocatedAmount,
      },
      select: { id: true },
    });
    if (rows.some((r) => !ownedAllocationIds.has(r.id))) duplicateGroupCount += 1;
  }
  const sharedBySourceLines = maps.length - new Set(maps.map((m) => m.targetId)).size;
  if (sharedBySourceLines > 0) duplicateGroupCount += sharedBySourceLines;

  let invoicePaidMismatchCount = 0;
  const sampleMismatches: SettlementReconcileResult['sampleMismatches'] = [];

  if (invoiceIds.length) {
    const invoices = await ctx.prisma.invoice.findMany({
      where: { id: { in: invoiceIds }, companyId: ctx.targetCompanyId },
      select: {
        id: true,
        invoiceNumber: true,
        paidAmount: true,
        paymentAllocations: { select: { allocatedAmount: true } },
      },
    });
    for (const inv of invoices) {
      const sum = inv.paymentAllocations.reduce(
        (acc, a) => acc.add(a.allocatedAmount),
        new Prisma.Decimal(0)
      );
      const paid = inv.paidAmount ?? new Prisma.Decimal(0);
      const diff = paid.sub(sum).abs();
      if (diff.gt(0.02) && inv.paymentAllocations.length > 0) {
        invoicePaidMismatchCount += 1;
        if (sampleMismatches.length < 20) {
          sampleMismatches.push({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber ?? inv.id,
            legacyPaid: money2(paid),
            allocationSum: money2(sum),
          });
        }
      }
    }
  }

  return {
    migratedInvoicesWithAllocations: allocationIds.length,
    invoicePaidMismatchCount,
    duplicateAllocationGroups: duplicateGroupCount,
    orphanAllocationCount,
    sampleMismatches,
  };
}

export type CommercialReconcileResult = {
  invoiceHeaderLineMismatchCount: number;
  sampleLineMismatches: { invoiceId: string; invoiceNumber: string; headerNet: string; lineSum: string }[];
};

export async function reconcileCommercialDocuments(ctx: MigrationContext): Promise<CommercialReconcileResult> {
  const invoiceMaps = await ctx.prisma.migrationIdMap.findMany({
    where: { migrationJobId: ctx.migrationJobId, targetModel: 'Invoice' },
    select: { targetId: true },
    take: 5000,
  });
  const ids = invoiceMaps.map((m) => m.targetId);
  let invoiceHeaderLineMismatchCount = 0;
  const sampleLineMismatches: CommercialReconcileResult['sampleLineMismatches'] = [];
  if (!ids.length) {
    return { invoiceHeaderLineMismatchCount: 0, sampleLineMismatches: [] };
  }
  const invoices = await ctx.prisma.invoice.findMany({
    where: { id: { in: ids }, companyId: ctx.targetCompanyId },
    select: {
      id: true,
      invoiceNumber: true,
      netAmount: true,
      lines: { select: { total: true } },
    },
  });
  for (const inv of invoices) {
    const sum = inv.lines.reduce((acc, l) => acc.add(l.total), new Prisma.Decimal(0));
    const net = inv.netAmount ?? new Prisma.Decimal(0);
    if (inv.lines.length > 0 && net.sub(sum).abs().gt(0.05)) {
      invoiceHeaderLineMismatchCount += 1;
      if (sampleLineMismatches.length < 15) {
        sampleLineMismatches.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber ?? inv.id,
          headerNet: money2(net),
          lineSum: money2(sum),
        });
      }
    }
  }
  return { invoiceHeaderLineMismatchCount, sampleLineMismatches };
}

export async function reconcileChequeHistorical(ctx: MigrationContext): Promise<ChequeReconcileResult> {
  const maps = await ctx.prisma.migrationIdMap.findMany({
    where: {
      migrationJobId: ctx.migrationJobId,
      targetModel: 'Cheque',
      outcome: { in: ['CREATED_BY_MIGRATION', 'ALREADY_MAPPED'] },
    },
    select: { targetId: true },
  });
  const ids = maps.map((m) => m.targetId);
  if (!ids.length) {
    return { migratedCheques: 0, chequesMissingJournalLink: 0, chequesByStatus: {} };
  }

  const cheques = await ctx.prisma.cheque.findMany({
    where: { id: { in: ids }, companyId: ctx.targetCompanyId },
    select: {
      status: true,
      portfolioJournalEntryId: true,
      clearJournalEntryId: true,
      depositJournalEntryId: true,
      endorseJournalEntryId: true,
    },
  });

  const chequesByStatus: Record<string, number> = {};
  let chequesMissingJournalLink = 0;
  for (const c of cheques) {
    chequesByStatus[c.status] = (chequesByStatus[c.status] ?? 0) + 1;
    const needsJe =
      c.status === 'COLLECTED' || c.status === 'SENT_TO_BANK' || c.status === 'ENDORSED';
    if (needsJe && !c.clearJournalEntryId && !c.depositJournalEntryId && !c.endorseJournalEntryId) {
      chequesMissingJournalLink += 1;
    }
    if (c.status === 'UNDER_HAND' && !c.portfolioJournalEntryId) {
      chequesMissingJournalLink += 1;
    }
  }

  return {
    migratedCheques: cheques.length,
    chequesMissingJournalLink,
    chequesByStatus,
  };
}
