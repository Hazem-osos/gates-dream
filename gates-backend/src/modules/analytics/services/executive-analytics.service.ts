import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { agedOpenItemsService, type AgingBucketKey as AgedOpenItemsBucketKey } from '../../accounting/services/aged-open-items.service';

export type AgingBucketKey = 'CURRENT' | 'PAST_DUE_31_60' | 'OVERDUE_61_90' | 'DELINQUENT_90_PLUS';

export function agingBucket(daysPast: number): AgingBucketKey {
  if (daysPast <= 30) return 'CURRENT';
  if (daysPast <= 60) return 'PAST_DUE_31_60';
  if (daysPast <= 90) return 'OVERDUE_61_90';
  return 'DELINQUENT_90_PLUS';
}

// H19: collapse the 5 due-date buckets used by the GL-reconciled aged-open-items
// report (the single source of truth for AR/AP aging) down to this dashboard's
// coarser 4-bucket KPI view, instead of re-deriving aging independently.
const BUCKET_MAP: Record<AgedOpenItemsBucketKey, AgingBucketKey> = {
  current_0_30: 'CURRENT',
  days_31_60: 'PAST_DUE_31_60',
  days_61_90: 'OVERDUE_61_90',
  days_91_120: 'DELINQUENT_90_PLUS',
  days_120_plus: 'DELINQUENT_90_PLUS',
};

export class ExecutiveAnalyticsService {
  async getAgingReport(params: {
    companyId: string;
    branchId?: string;
    asOfDate: Date;
    partyType: 'CUSTOMER' | 'SUPPLIER';
  }) {
    const isCustomer = params.partyType === 'CUSTOMER';

    // H19: source invoice-level aging from the single GL-reconciled
    // implementation (due-date buckets, includes offsetting SALE_RETURN /
    // PURCHASE_RETURN kinds) instead of a second ad-hoc invoice-date query.
    const agedReport = isCustomer
      ? await agedOpenItemsService.getAgedReceivables({
          companyId: params.companyId,
          branchId: params.branchId,
          asOfDate: params.asOfDate,
        })
      : await agedOpenItemsService.getAgedPayables({
          companyId: params.companyId,
          branchId: params.branchId,
          asOfDate: params.asOfDate,
        });

    type PartyAgg = {
      partyId: string;
      partyName: string;
      creditLimit: number | null;
      totalBalance: number;
      buckets: Record<AgingBucketKey, number>;
      invoices: Array<{
        invoiceId: string;
        invoiceNumber: string | null;
        amount: number;
        bucket: AgingBucketKey;
        invoiceDate: Date;
      }>;
    };

    const byParty = new Map<string, PartyAgg>();

    for (const party of agedReport.parties) {
      const buckets: Record<AgingBucketKey, number> = {
        CURRENT: 0,
        PAST_DUE_31_60: 0,
        OVERDUE_61_90: 0,
        DELINQUENT_90_PLUS: 0,
      };
      for (const [key, value] of Object.entries(party.buckets) as Array<
        [AgedOpenItemsBucketKey, number]
      >) {
        const mapped = BUCKET_MAP[key];
        buckets[mapped] = roundTo4(buckets[mapped] + value);
      }

      byParty.set(party.partyId, {
        partyId: party.partyId,
        partyName: party.partyName,
        creditLimit: null,
        totalBalance: roundTo4(party.total),
        buckets,
        invoices: party.invoices.map((line) => ({
          invoiceId: line.invoiceId,
          invoiceNumber: line.invoiceNumber,
          amount: roundTo4(line.remainingAmount),
          bucket: BUCKET_MAP[line.bucket],
          invoiceDate: line.date,
        })),
      });
    }

    if (isCustomer) {
      const customers = await prisma.customer.findMany({
        where: { id: { in: [...byParty.keys()] } },
        select: { id: true, arabicName: true, creditLimit: true },
      });
      for (const c of customers) {
        const row = byParty.get(c.id);
        if (row) {
          row.partyName = c.arabicName;
          row.creditLimit = c.creditLimit != null ? Number(c.creditLimit) : null;
        }
      }
    } else {
      const suppliers = await prisma.supplier.findMany({
        where: { id: { in: [...byParty.keys()] } },
        select: { id: true, arabicName: true, creditLimit: true },
      });
      for (const s of suppliers) {
        const row = byParty.get(s.id);
        if (row) {
          row.partyName = s.arabicName;
          row.creditLimit = s.creditLimit != null ? Number(s.creditLimit) : null;
        }
      }
    }

    const parties = [...byParty.values()].map((p) => ({
      ...p,
      overCreditLimit:
        p.creditLimit != null && p.creditLimit > 0
          ? p.totalBalance > p.creditLimit
          : false,
    }));

    return {
      asOfDate: params.asOfDate,
      partyType: params.partyType,
      parties,
      summary: {
        totalOutstanding: roundTo4(parties.reduce((s, p) => s + p.totalBalance, 0)),
        partyCount: parties.length,
      },
    };
  }

  async getExecutiveKpis(params: { companyId: string; branchId?: string; months?: number }) {
    const months = params.months ?? 6;
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const baseInvoiceWhere = {
      companyId: params.companyId,
      isPosted: true,
      isCancelled: false,
      ...(params.branchId ? { branchId: params.branchId } : {}),
    };

    const monthKey = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

    const monthRanges: Array<{ key: string; gte: Date; lte: Date }> = [];
    for (let offset = months - 1; offset >= 0; offset -= 1) {
      const gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const lte =
        offset === 0
          ? now
          : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 0, 23, 59, 59, 999));
      monthRanges.push({ key: monthKey(gte), gte, lte });
    }

    const trendAggregates = monthRanges.flatMap(({ key, gte, lte }) => [
      prisma.invoice
        .aggregate({
          where: { ...baseInvoiceWhere, invoiceKind: 'SALE', date: { gte, lte } },
          _sum: { netAmount: true },
        })
        .then((r) => ({ key, kind: 'sales' as const, total: Number(r._sum.netAmount ?? 0) })),
      prisma.invoice
        .aggregate({
          where: { ...baseInvoiceWhere, invoiceKind: 'PURCHASE', date: { gte, lte } },
          _sum: { netAmount: true },
        })
        .then((r) => ({ key, kind: 'purchase' as const, total: Number(r._sum.netAmount ?? 0) })),
    ]);

    const trendStart = monthRanges[0]?.gte ?? monthStart;

    const [
      monthlySalesAgg,
      monthlyPurchasesAgg,
      trendResults,
      safes,
      banks,
      unpostedJe,
      unpostedInv,
      unpostedCash,
      topCustomerGroups,
      topProducts,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          ...baseInvoiceWhere,
          invoiceKind: 'SALE',
          date: { gte: monthStart, lte: now },
        },
        _sum: { netAmount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          ...baseInvoiceWhere,
          invoiceKind: 'PURCHASE',
          date: { gte: monthStart, lte: now },
        },
        _sum: { netAmount: true },
      }),
      Promise.all(trendAggregates),
      prisma.safe.findMany({
        where: { companyId: params.companyId },
        select: { balance: true },
      }),
      prisma.bankAccount.findMany({
        where: { companyId: params.companyId },
        select: { balance: true },
      }),
      prisma.journalEntry.count({
        where: {
          companyId: params.companyId,
          isPosted: false,
          isCancelled: false,
          deletedAt: null,
        },
      }),
      prisma.invoice.count({
        where: {
          companyId: params.companyId,
          isPosted: false,
          isCancelled: false,
        },
      }),
      prisma.cashTransaction.count({
        where: { companyId: params.companyId, isPosted: false, isCancelled: false },
      }),
      prisma.invoice.groupBy({
        by: ['customerId'],
        where: {
          ...baseInvoiceWhere,
          invoiceKind: 'SALE',
          date: { gte: trendStart, lte: now },
          customerId: { not: null },
        },
        _sum: { netAmount: true },
        orderBy: { _sum: { netAmount: 'desc' } },
        take: 5,
      }),
      prisma.invoiceLine.groupBy({
        by: ['itemId'],
        where: {
          invoice: {
            companyId: params.companyId,
            isPosted: true,
            invoiceKind: 'SALE',
            date: { gte: trendStart, lte: now },
            ...(params.branchId ? { branchId: params.branchId } : {}),
          },
        },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
    ]);

    const salesByMonth: Record<string, number> = {};
    const purchaseByMonth: Record<string, number> = {};
    for (const row of trendResults) {
      if (row.kind === 'sales') {
        salesByMonth[row.key] = roundTo4(row.total);
      } else {
        purchaseByMonth[row.key] = roundTo4(row.total);
      }
    }

    const monthlySales = roundTo4(Number(monthlySalesAgg._sum.netAmount ?? 0));
    const monthlyPurchases = roundTo4(Number(monthlyPurchasesAgg._sum.netAmount ?? 0));
    const monthKeyCurrent = monthKey(now);

    const customerIds = topCustomerGroups
      .map((g) => g.customerId)
      .filter((id): id is string => Boolean(id));
    const customerNames = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, arabicName: true },
    });
    const nameMap = new Map(customerNames.map((c) => [c.id, c.arabicName]));

    const itemIds = topProducts.map((p) => p.itemId!).filter(Boolean);
    const items = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, arabicName: true },
    });
    const itemMap = new Map(items.map((i) => [i.id, i.arabicName]));

    const cashLiquidity = roundTo4(
      safes.reduce((s, x) => s + Number(x.balance), 0) +
        banks.reduce((s, x) => s + Number(x.balance), 0)
    );

    const revenueAccounts = await prisma.account.findMany({
      where: { companyId: params.companyId, accountType: 'revenue', isActive: true, deletedAt: null },
      select: { id: true },
    });
    const expenseAccounts = await prisma.account.findMany({
      where: { companyId: params.companyId, accountType: 'expense', isActive: true, deletedAt: null },
      select: { id: true },
    });

    const jeWhere = {
      companyId: params.companyId,
      isPosted: true,
      isCancelled: false,
      date: { gte: monthStart, lte: now },
      ...(params.branchId ? { branchId: params.branchId } : {}),
    };

    const [revLines, expLines] = await Promise.all([
      revenueAccounts.length
        ? prisma.journalEntryLine.findMany({
            where: { accountId: { in: revenueAccounts.map((a) => a.id) }, journalEntry: jeWhere },
            select: { debitBase: true, creditBase: true },
          })
        : Promise.resolve([]),
      expenseAccounts.length
        ? prisma.journalEntryLine.findMany({
            where: { accountId: { in: expenseAccounts.map((a) => a.id) }, journalEntry: jeWhere },
            select: { debitBase: true, creditBase: true },
          })
        : Promise.resolve([]),
    ]);

    const revenueTotal = revLines.reduce(
      (s, l) => roundTo4(s + Number(l.creditBase) - Number(l.debitBase)),
      0
    );
    const expenseTotal = expLines.reduce(
      (s, l) => roundTo4(s + Number(l.debitBase) - Number(l.creditBase)),
      0
    );
    const netProfitLoss =
      revenueTotal !== 0 || expenseTotal !== 0
        ? roundTo4(revenueTotal - expenseTotal)
        : roundTo4(monthlySales - monthlyPurchases);

    return {
      periodTotals: {
        monthlySales,
        monthlyPurchases,
        netProfitLoss,
        month: monthKeyCurrent,
      },
      monthlyTrend: { salesByMonth, purchaseByMonth },
      cashAndBankLiquidity: cashLiquidity,
      topCustomers: topCustomerGroups.map((g) => ({
        customerId: g.customerId!,
        customerName: nameMap.get(g.customerId!) ?? g.customerId!,
        revenue: Number(g._sum.netAmount ?? 0),
      })),
      topProducts: topProducts.map((p) => ({
        itemId: p.itemId,
        itemName: p.itemId ? itemMap.get(p.itemId) ?? p.itemId : null,
        quantity: Number(p._sum.quantity ?? 0),
        revenue: Number(p._sum.total ?? 0),
      })),
      pendingDocuments: {
        unpostedJournalEntries: unpostedJe,
        unpostedInvoices: unpostedInv,
        unpostedTreasuryTransactions: unpostedCash,
        total: unpostedJe + unpostedInv + unpostedCash,
      },
    };
  }
}

export const executiveAnalyticsService = new ExecutiveAnalyticsService();
