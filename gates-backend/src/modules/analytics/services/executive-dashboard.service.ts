import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  agingBucket,
  executiveAnalyticsService,
} from './executive-analytics.service';

type CacheEntry = { at: number; data: unknown };
const overviewCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

function withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = overviewCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Promise.resolve(hit.data as T);
  }
  return fn().then((data) => {
    overviewCache.set(key, { at: Date.now(), data });
    return data;
  });
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function invoiceMarginPercent(
  netAmount: number,
  lines: Array<{ total: unknown; quantity: unknown; item: { beginningCostPrice: unknown } | null }>
): number {
  let revenue = 0;
  let cogs = 0;
  for (const line of lines) {
    revenue += Number(line.total);
    const unitCost = line.item?.beginningCostPrice != null ? Number(line.item.beginningCostPrice) : 0;
    cogs += Number(line.quantity) * unitCost;
  }
  const base = revenue > 0 ? revenue : netAmount;
  if (base <= 0) return 0;
  return roundTo4(((base - cogs) / base) * 100);
}

export class ExecutiveDashboardService {
  async getOverview(params: { companyId: string; branchId?: string }) {
    const cacheKey = `overview:${params.companyId}:${params.branchId ?? ''}`;
    return withCache(cacheKey, () => this.buildOverview(params));
  }

  private async buildOverview(params: { companyId: string; branchId?: string }) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59));

    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const in14Days = new Date(now);
    in14Days.setDate(in14Days.getDate() + 14);

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const invoiceBase = {
      companyId: params.companyId,
      isPosted: true,
      isCancelled: false,
      ...(params.branchId ? { branchId: params.branchId } : {}),
    };

    const [
      safes,
      banks,
      salesThisMonth,
      salesLastMonth,
      saleLinesThisMonth,
      aging,
      purchaseAp,
      chequesInWeek,
      chequesOut7,
      chequesOut14,
      trendMonths,
      salesTodayAgg,
      companySettingsRow,
    ] = await Promise.all([
      prisma.safe.findMany({
        where: { companyId: params.companyId, isActive: true },
        select: { balance: true },
      }),
      prisma.bankAccount.findMany({
        where: { companyId: params.companyId, isActive: true },
        select: { balance: true },
      }),
      prisma.invoice.aggregate({
        where: {
          ...invoiceBase,
          invoiceKind: 'SALE',
          date: { gte: monthStart, lte: now },
        },
        _sum: { netAmount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          ...invoiceBase,
          invoiceKind: 'SALE',
          date: { gte: prevMonthStart, lte: prevMonthEnd },
        },
        _sum: { netAmount: true },
      }),
      prisma.invoiceLine.findMany({
        where: {
          invoice: {
            ...invoiceBase,
            invoiceKind: 'SALE',
            date: { gte: monthStart, lte: now },
          },
        },
        select: {
          total: true,
          quantity: true,
          item: { select: { beginningCostPrice: true } },
        },
      }),
      executiveAnalyticsService.getAgingReport({
        companyId: params.companyId,
        branchId: params.branchId,
        asOfDate: now,
        partyType: 'CUSTOMER',
      }),
      prisma.invoice.aggregate({
        where: {
          ...invoiceBase,
          invoiceKind: 'PURCHASE',
          remainingAmount: { gt: 0 },
        },
        _sum: { remainingAmount: true },
      }),
      prisma.cheque.aggregate({
        where: {
          companyId: params.companyId,
          direction: 'INWARD',
          dueDate: { gte: weekStart, lte: weekEnd },
          status: { notIn: ['COLLECTED', 'CANCELLED', 'BOUNCED'] },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.cheque.aggregate({
        where: {
          companyId: params.companyId,
          direction: 'OUTWARD',
          dueDate: { gte: now, lte: weekEnd },
          status: { notIn: ['COLLECTED', 'CANCELLED', 'BOUNCED'] },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.cheque.aggregate({
        where: {
          companyId: params.companyId,
          direction: 'OUTWARD',
          dueDate: { gte: now, lte: in14Days },
          status: { notIn: ['COLLECTED', 'CANCELLED', 'BOUNCED'] },
        },
        _sum: { amount: true },
        _count: true,
      }),
      executiveAnalyticsService.getExecutiveKpis({
        companyId: params.companyId,
        branchId: params.branchId,
        months: 6,
      }),
      prisma.invoice.aggregate({
        where: {
          ...invoiceBase,
          invoiceKind: 'SALE',
          date: { gte: dayStart, lte: now },
        },
        _sum: { netAmount: true },
      }),
      prisma.companySettings.findUnique({
        where: { companyId: params.companyId },
        select: { advancedSettings: true },
      }),
    ]);

    const safeTotal = roundTo4(safes.reduce((s, x) => s + Number(x.balance), 0));
    const bankTotal = roundTo4(banks.reduce((s, x) => s + Number(x.balance), 0));
    const netLiquidity = roundTo4(safeTotal + bankTotal);

    let cogs = 0;
    let lineRevenue = 0;
    for (const line of saleLinesThisMonth) {
      lineRevenue += Number(line.total);
      const unitCost =
        line.item?.beginningCostPrice != null ? Number(line.item.beginningCostPrice) : 0;
      cogs += Number(line.quantity) * unitCost;
    }
    const monthlyRevenue = roundTo4(Number(salesThisMonth._sum.netAmount ?? 0));
    const grossProfit = roundTo4(lineRevenue > 0 ? lineRevenue - cogs : monthlyRevenue - cogs);
    const grossMarginPct =
      monthlyRevenue > 0 ? roundTo4((grossProfit / monthlyRevenue) * 100) : 0;

    const lastMonthRevenue = roundTo4(Number(salesLastMonth._sum.netAmount ?? 0));
    const revenueGrowthPct =
      lastMonthRevenue > 0
        ? roundTo4(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : monthlyRevenue > 0
          ? 100
          : 0;

    let arCurrent = 0;
    let arOverdue60 = 0;
    for (const p of aging.parties) {
      arCurrent = roundTo4(
        arCurrent + p.buckets.CURRENT + p.buckets.PAST_DUE_31_60
      );
      arOverdue60 = roundTo4(
        arOverdue60 + p.buckets.OVERDUE_61_90 + p.buckets.DELINQUENT_90_PLUS
      );
    }

    const supplierAp14 = roundTo4(Number(purchaseAp._sum.remainingAmount ?? 0));
    const outwardCheques14 = roundTo4(Number(chequesOut14._sum.amount ?? 0));
    const shortTermCommitments = roundTo4(supplierAp14 + outwardCheques14);

    const salesSpark = Object.entries(trendMonths.monthlyTrend.salesByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
    const liquiditySpark = salesSpark.map((s, i) => {
      const p = Object.entries(trendMonths.monthlyTrend.purchaseByMonth).sort(([a], [b]) =>
        a.localeCompare(b)
      )[i]?.[1] ?? 0;
      return roundTo4(s + netLiquidity * 0.01 - p * 0.05);
    });

    const revenueAccounts = await prisma.account.findMany({
      where: {
        companyId: params.companyId,
        accountType: 'revenue',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    const expenseAccounts = await prisma.account.findMany({
      where: {
        companyId: params.companyId,
        accountType: 'expense',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    const sixMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const jeWhere = {
      companyId: params.companyId,
      isPosted: true,
      isCancelled: false,
      date: { gte: sixMonthStart, lte: now },
      ...(params.branchId ? { branchId: params.branchId } : {}),
    };

    const jeLines =
      revenueAccounts.length || expenseAccounts.length
        ? await prisma.journalEntryLine.findMany({
            where: {
              journalEntry: jeWhere,
              OR: [
                ...(revenueAccounts.length
                  ? [{ accountId: { in: revenueAccounts.map((a) => a.id) } }]
                  : []),
                ...(expenseAccounts.length
                  ? [{ accountId: { in: expenseAccounts.map((a) => a.id) } }]
                  : []),
              ],
            },
            select: {
              debitBase: true,
              creditBase: true,
              accountId: true,
              journalEntry: { select: { date: true } },
            },
          })
        : [];

    const revIds = new Set(revenueAccounts.map((a) => a.id));
    const expIds = new Set(expenseAccounts.map((a) => a.id));
    const cashFlowByMonth: Record<string, { inflow: number; expense: number }> = {};

    for (const line of jeLines) {
      const k = monthKey(line.journalEntry.date);
      if (!cashFlowByMonth[k]) cashFlowByMonth[k] = { inflow: 0, expense: 0 };
      if (revIds.has(line.accountId)) {
        cashFlowByMonth[k].inflow = roundTo4(
          cashFlowByMonth[k].inflow + Number(line.creditBase) - Number(line.debitBase)
        );
      }
      if (expIds.has(line.accountId)) {
        cashFlowByMonth[k].expense = roundTo4(
          cashFlowByMonth[k].expense + Number(line.debitBase) - Number(line.creditBase)
        );
      }
    }

    const fallbackTrend = Object.entries(trendMonths.monthlyTrend.salesByMonth).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [k, sales] of fallbackTrend) {
      if (!cashFlowByMonth[k]) {
        cashFlowByMonth[k] = {
          inflow: sales,
          expense: trendMonths.monthlyTrend.purchaseByMonth[k] ?? 0,
        };
      }
    }

    const monthlyCashFlow = Object.entries(cashFlowByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, inflow: v.inflow, expense: v.expense }));

    const todaySales = roundTo4(Number(salesTodayAgg._sum.netAmount ?? 0));
    const adv = companySettingsRow?.advancedSettings as Record<string, unknown> | null;
    const dailySalesTarget =
      typeof adv?.dailySalesTarget === 'number'
        ? adv.dailySalesTarget
        : typeof adv?.dailySalesTarget === 'string'
          ? Number(adv.dailySalesTarget) || 0
          : 0;

    return {
      liquidity: {
        netAvailable: netLiquidity,
        safes: safeTotal,
        banks: bankTotal,
        sparkline: liquiditySpark.length ? liquiditySpark : [netLiquidity],
      },
      monthlyPerformance: {
        revenue: monthlyRevenue,
        grossProfit,
        grossMarginPct,
        revenueGrowthPctVsLastMonth: revenueGrowthPct,
        sparkline: salesSpark.length ? salesSpark : [monthlyRevenue],
      },
      receivables: {
        total: aging.summary.totalOutstanding,
        current: arCurrent,
        overdueOver60Days: arOverdue60,
        sparkline: salesSpark,
      },
      shortTermCommitments: {
        total: shortTermCommitments,
        supplierApDue14Days: supplierAp14,
        outwardChequesDue14Days: outwardCheques14,
      },
      chequesPipeline: {
        inwardDueThisWeek: {
          count: chequesInWeek._count,
          amount: roundTo4(Number(chequesInWeek._sum.amount ?? 0)),
        },
        outwardDueNext7Days: {
          count: chequesOut7._count,
          amount: roundTo4(Number(chequesOut7._sum.amount ?? 0)),
        },
        sparkline: [
          roundTo4(Number(chequesInWeek._sum.amount ?? 0)),
          roundTo4(Number(chequesOut7._sum.amount ?? 0)),
        ],
      },
      monthlyCashFlow,
      dailyMilestone: {
        todaySales,
        dailySalesTarget,
        targetReached: dailySalesTarget > 0 && todaySales >= dailySalesTarget,
      },
      asOf: now.toISOString(),
    };
  }

  async getRiskFeed(params: { companyId: string; branchId?: string }) {
    const now = new Date();
    const since48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const branchFilter = params.branchId ? { branchId: params.branchId } : {};

    const [topSaleItems, aging, recentSales, modifiedInvoices, modifiedJe, pendingInvoices, pendingJe] =
      await Promise.all([
        prisma.invoiceLine.groupBy({
          by: ['itemId'],
          where: {
            invoice: {
              companyId: params.companyId,
              isPosted: true,
              invoiceKind: 'SALE',
              date: { gte: since30d },
              ...branchFilter,
            },
          },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 15,
        }),
        executiveAnalyticsService.getAgingReport({
          companyId: params.companyId,
          branchId: params.branchId,
          asOfDate: now,
          partyType: 'CUSTOMER',
        }),
        prisma.invoice.findMany({
          where: {
            companyId: params.companyId,
            isPosted: true,
            invoiceKind: 'SALE',
            date: { gte: since30d },
            ...branchFilter,
          },
          select: {
            id: true,
            invoiceNumber: true,
            netAmount: true,
            lines: {
              select: {
                total: true,
                quantity: true,
                item: { select: { beginningCostPrice: true } },
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 80,
        }),
        prisma.invoice.findMany({
          where: {
            companyId: params.companyId,
            isPosted: false,
            isCancelled: false,
            updatedAt: { gte: since48h },
            ...branchFilter,
          },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceKind: true,
            updatedAt: true,
            workflowStatus: true,
          },
          take: 15,
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.journalEntry.findMany({
          where: {
            companyId: params.companyId,
            isPosted: false,
            isCancelled: false,
            deletedAt: null,
            updatedAt: { gte: since48h },
            ...branchFilter,
          },
          select: { id: true, voucherNumber: true, legacyGlNum: true, updatedAt: true, workflowStatus: true },
          take: 15,
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.invoice.findMany({
          where: {
            companyId: params.companyId,
            workflowStatus: 'PENDING_APPROVAL',
            isCancelled: false,
            ...branchFilter,
          },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceKind: true,
            workflowSubmittedAt: true,
            netAmount: true,
          },
          take: 10,
          orderBy: { workflowSubmittedAt: 'desc' },
        }),
        prisma.journalEntry.findMany({
          where: {
            companyId: params.companyId,
            workflowStatus: 'PENDING_APPROVAL',
            isCancelled: false,
            deletedAt: null,
            ...branchFilter,
          },
          select: {
            id: true,
            voucherNumber: true,
            legacyGlNum: true,
            workflowSubmittedAt: true,
          },
          take: 10,
          orderBy: { workflowSubmittedAt: 'desc' },
        }),
      ]);

    const itemIds = topSaleItems.map((t) => t.itemId).filter(Boolean) as string[];
    const [items, qtyRows] = await Promise.all([
      prisma.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, arabicName: true, orderLimit: true },
      }),
      itemIds.length
        ? prisma.itemQuantity.groupBy({
            by: ['itemId'],
            where: { itemId: { in: itemIds } },
            _sum: { quantity: true },
          })
        : Promise.resolve([]),
    ]);

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const qtyMap = new Map(qtyRows.map((q) => [q.itemId, Number(q._sum.quantity ?? 0)]));

    type RiskItem = {
      id: string;
      severity: 'high' | 'medium' | 'low';
      category: string;
      title: string;
      detail: string;
      actionLabel?: string;
      href?: string;
      meta?: Record<string, unknown>;
    };

    const flags: RiskItem[] = [];

    for (const row of topSaleItems) {
      if (!row.itemId) continue;
      const item = itemMap.get(row.itemId);
      const onHand = qtyMap.get(row.itemId) ?? 0;
      const reorder = item?.orderLimit != null ? Number(item.orderLimit) : null;
      if (reorder != null && reorder > 0 && onHand <= reorder) {
        flags.push({
          id: `low-stock-${row.itemId}`,
          severity: onHand <= reorder * 0.5 ? 'high' : 'medium',
          category: 'LOW_STOCK',
          title: 'تنبيه نقص مخزون',
          detail: `${item?.arabicName ?? row.itemId} — المتبقي ${onHand} (حد الطلب ${reorder})`,
          actionLabel: 'طلب شراء سريع',
          href: '/inventory/operations/purchase-invoice',
          meta: { itemId: row.itemId, onHand, reorderPoint: reorder },
        });
      }
    }

    for (const inv of recentSales) {
      const margin = invoiceMarginPercent(Number(inv.netAmount), inv.lines);
      if (margin < 5) {
        flags.push({
          id: `low-margin-${inv.id}`,
          severity: margin < 0 ? 'high' : 'medium',
          category: 'LOW_MARGIN_INVOICE',
          title: 'هامش ربح منخفض',
          detail: `فاتورة ${inv.invoiceNumber ?? inv.id} — هامش ${margin}%`,
          href: '/inventory/operations/sales-invoice',
          meta: { invoiceId: inv.id, marginPct: margin },
        });
      }
    }

    for (const inv of modifiedInvoices) {
      flags.push({
        id: `audit-inv-${inv.id}`,
        severity: 'low',
        category: 'AUDIT_UNPOSTED',
        title: 'مستند غير مرحّل (48 ساعة)',
        detail: `${inv.invoiceKind ?? 'INVOICE'} ${inv.invoiceNumber ?? inv.id} — ${inv.workflowStatus}`,
        href: '/inventory/operations/sales-invoice',
        meta: { entityType: 'INVOICE', entityId: inv.id, updatedAt: inv.updatedAt },
      });
    }
    for (const je of modifiedJe) {
      flags.push({
        id: `audit-je-${je.id}`,
        severity: 'low',
        category: 'AUDIT_UNPOSTED',
        title: 'قيد غير مرحّل (48 ساعة)',
        detail: `قيد ${je.voucherNumber ?? je.legacyGlNum ?? je.id}`,
        href: '/accounting/operations/journal-entry',
        meta: { entityType: 'JOURNAL_ENTRY', entityId: je.id, updatedAt: je.updatedAt },
      });
    }

    for (const p of aging.parties) {
      if (p.overCreditLimit) {
        flags.push({
          id: `credit-${p.partyId}`,
          severity: 'high',
          category: 'CREDIT_LIMIT',
          title: 'تجاوز حد ائتماني',
          detail: `${p.partyName || p.partyId} — الرصيد ${p.totalBalance} / الحد ${p.creditLimit}`,
          actionLabel: 'اعتماد',
          href: '/accounting/masters/customers',
          meta: { customerId: p.partyId, balance: p.totalBalance, creditLimit: p.creditLimit },
        });
      }
    }

    for (const inv of pendingInvoices) {
      flags.push({
        id: `approval-inv-${inv.id}`,
        severity: 'high',
        category: 'PENDING_APPROVAL',
        title: 'اعتماد مطلوب — فاتورة',
        detail: `${inv.invoiceKind ?? ''} ${inv.invoiceNumber ?? inv.id} — ${formatMoneyShort(Number(inv.netAmount))}`,
        actionLabel: 'اعتماد',
        href: '/inventory/operations/sales-invoice',
        meta: { entityType: 'INVOICE', entityId: inv.id },
      });
    }
    for (const je of pendingJe) {
      flags.push({
        id: `approval-je-${je.id}`,
        severity: 'high',
        category: 'PENDING_APPROVAL',
        title: 'اعتماد مطلوب — قيد',
        detail: `قيد ${je.voucherNumber ?? je.legacyGlNum ?? je.id}`,
        actionLabel: 'اعتماد',
        href: '/accounting/operations/journal-entry',
        meta: { entityType: 'JOURNAL_ENTRY', entityId: je.id },
      });
    }

    const overdueInvoices = aging.parties.flatMap((p) =>
      p.invoices
        .filter((i) => {
          const bucket = agingBucket(daysBetween(i.invoiceDate, now));
          return bucket === 'OVERDUE_61_90' || bucket === 'DELINQUENT_90_PLUS';
        })
        .map((i) => ({ ...i, partyName: p.partyName }))
    );
    overdueInvoices.sort((a, b) => b.amount - a.amount);
    for (const inv of overdueInvoices.slice(0, 5)) {
      flags.push({
        id: `overdue-${inv.invoiceId}`,
        severity: 'medium',
        category: 'OVERDUE_RECEIVABLE',
        title: 'فاتورة متأخرة',
        detail: `${inv.partyName} — ${formatMoneyShort(inv.amount)} (${inv.invoiceNumber ?? ''})`,
        actionLabel: 'إرسال تذكير',
        href: '/inventory/operations/sales-invoice',
        meta: { invoiceId: inv.invoiceId, amount: inv.amount },
      });
    }

    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [marginLines, nightInvoices, nightJe, discountLines, bouncedCheques] =
      await Promise.all([
        prisma.invoiceLine.findMany({
          where: {
            invoice: {
              companyId: params.companyId,
              isPosted: true,
              isCancelled: false,
              invoiceKind: 'SALE',
              date: { gte: since7d },
              ...branchFilter,
            },
          },
          select: {
            price: true,
            discountPercent: true,
            item: { select: { arabicName: true, beginningCostPrice: true } },
            invoice: { select: { id: true, invoiceNumber: true } },
          },
          take: 120,
          orderBy: { lineOrder: 'desc' },
        }),
        prisma.invoice.findMany({
          where: {
            companyId: params.companyId,
            updatedAt: { gte: since48h },
            ...branchFilter,
          },
          select: { id: true, invoiceNumber: true, updatedAt: true, isPosted: true },
          take: 40,
        }),
        prisma.journalEntry.findMany({
          where: {
            companyId: params.companyId,
            deletedAt: null,
            updatedAt: { gte: since48h },
            ...branchFilter,
          },
          select: { id: true, voucherNumber: true, updatedAt: true, isPosted: true },
          take: 40,
        }),
        prisma.invoiceLine.findMany({
          where: {
            discountPercent: { gt: 15 },
            invoice: {
              companyId: params.companyId,
              isPosted: true,
              invoiceKind: 'SALE',
              isCancelled: false,
              ...branchFilter,
            },
          },
          select: {
            discountPercent: true,
            invoice: { select: { id: true, invoiceNumber: true } },
            item: { select: { arabicName: true } },
          },
          take: 15,
          orderBy: { lineOrder: 'desc' },
        }),
        prisma.cheque.findMany({
          where: {
            companyId: params.companyId,
            status: 'BOUNCED',
            customerId: { not: null },
          },
          select: { customerId: true, amount: true, chequeNumber: true },
          take: 50,
        }),
      ]);

    const bouncedCustomerIds = new Set(
      bouncedCheques.map((c) => c.customerId).filter(Boolean) as string[]
    );

    for (const line of marginLines) {
      const cost = line.item?.beginningCostPrice != null ? Number(line.item.beginningCostPrice) : 0;
      const price = Number(line.price ?? 0);
      if (cost > 0 && price < cost) {
        flags.push({
          id: `fraud-margin-${line.invoice.id}-${line.item?.arabicName ?? ''}`,
          severity: 'high',
          category: 'FRAUD_NEGATIVE_MARGIN',
          title: 'بيع تحت التكلفة',
          detail: `${line.item?.arabicName ?? 'صنف'} — سعر ${price} أقل من التكلفة ${cost} (فاتورة ${line.invoice.invoiceNumber ?? line.invoice.id})`,
          href: '/inventory/operations/sales-invoice',
          meta: { invoiceId: line.invoice.id, unitPrice: price, cost },
        });
        break;
      }
    }

    for (const inv of nightInvoices) {
      if (!isAfterHoursCairo(inv.updatedAt)) continue;
      flags.push({
        id: `fraud-night-inv-${inv.id}`,
        severity: inv.isPosted ? 'high' : 'medium',
        category: 'FRAUD_AFTER_HOURS',
        title: 'نشاط خارج الدوام — فاتورة',
        detail: `${inv.invoiceNumber ?? inv.id} — ${inv.updatedAt.toISOString()}`,
        href: '/inventory/operations/sales-invoice',
        meta: { entityId: inv.id, updatedAt: inv.updatedAt },
      });
      if (flags.filter((f) => f.category === 'FRAUD_AFTER_HOURS').length >= 5) break;
    }
    for (const je of nightJe) {
      if (!isAfterHoursCairo(je.updatedAt)) continue;
      flags.push({
        id: `fraud-night-je-${je.id}`,
        severity: 'medium',
        category: 'FRAUD_AFTER_HOURS',
        title: 'نشاط خارج الدوام — قيد',
        detail: `${je.voucherNumber ?? je.id} — ${je.updatedAt.toISOString()}`,
        href: '/accounting/operations/journal-entry',
        meta: { entityId: je.id, updatedAt: je.updatedAt },
      });
      if (flags.filter((f) => f.category === 'FRAUD_AFTER_HOURS').length >= 8) break;
    }

    for (const dl of discountLines.slice(0, 5)) {
      flags.push({
        id: `fraud-disc-${dl.invoice.id}`,
        severity: 'medium',
        category: 'FRAUD_HIGH_DISCOUNT',
        title: 'خصم يتجاوز السياسة (>15%)',
        detail: `${dl.item?.arabicName ?? 'صنف'} — خصم ${Number(dl.discountPercent)}% على ${dl.invoice.invoiceNumber ?? dl.invoice.id}`,
        href: '/inventory/operations/sales-invoice',
        meta: { invoiceId: dl.invoice.id, discountPct: Number(dl.discountPercent) },
      });
    }

    for (const p of aging.parties) {
      if (!p.overCreditLimit || !p.partyId) continue;
      if (!bouncedCustomerIds.has(p.partyId)) continue;
      flags.push({
        id: `fraud-credit-bounce-${p.partyId}`,
        severity: 'high',
        category: 'FRAUD_CREDIT_BOUNCED',
        title: 'حد ائتمان + شيك مرتجع',
        detail: `${p.partyName || p.partyId} — رصيد ${formatMoneyShort(p.totalBalance)} مع شيكات مرتجعة`,
        href: '/accounting/masters/customers',
        meta: { customerId: p.partyId },
      });
    }

    const order = { high: 0, medium: 1, low: 2 };
    flags.sort((a, b) => order[a.severity] - order[b.severity]);

    return { generatedAt: now.toISOString(), flags: flags.slice(0, 40) };
  }

  async getAnalytics(params: { companyId: string; branchId?: string }) {
    const now = new Date();
    const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const branchFilter = params.branchId ? { branchId: params.branchId } : {};

    const saleLines = await prisma.invoiceLine.findMany({
      where: {
        invoice: {
          companyId: params.companyId,
          isPosted: true,
          invoiceKind: 'SALE',
          date: { gte: start, lte: now },
          ...branchFilter,
        },
      },
      select: {
        itemId: true,
        total: true,
        quantity: true,
        item: { select: { arabicName: true, beginningCostPrice: true } },
      },
    });

    const profitByItem = new Map<
      string,
      { itemId: string; name: string; grossProfit: number; revenue: number }
    >();
    for (const line of saleLines) {
      const revenue = Number(line.total);
      const cost =
        Number(line.quantity) *
        (line.item?.beginningCostPrice != null ? Number(line.item.beginningCostPrice) : 0);
      const gp = roundTo4(revenue - cost);
      const prev = profitByItem.get(line.itemId) ?? {
        itemId: line.itemId,
        name: line.item?.arabicName ?? line.itemId,
        grossProfit: 0,
        revenue: 0,
      };
      prev.grossProfit = roundTo4(prev.grossProfit + gp);
      prev.revenue = roundTo4(prev.revenue + revenue);
      profitByItem.set(line.itemId, prev);
    }

    const topProfitableItems = [...profitByItem.values()]
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, 5);

    const collections = await prisma.paymentAllocation.groupBy({
      by: ['invoiceId'],
      where: {
        companyId: params.companyId,
        allocatedAt: { gte: start, lte: now },
      },
      _sum: { allocatedAmount: true },
    });

    const invoiceIds = collections.map((c) => c.invoiceId);
    const invoices =
      invoiceIds.length > 0
        ? await prisma.invoice.findMany({
            where: { id: { in: invoiceIds }, customerId: { not: null } },
            select: { id: true, customerId: true },
          })
        : [];
    const invCustomer = new Map(invoices.map((i) => [i.id, i.customerId!]));

    const byCustomer = new Map<string, number>();
    for (const row of collections) {
      const cid = invCustomer.get(row.invoiceId);
      if (!cid) continue;
      byCustomer.set(
        cid,
        roundTo4((byCustomer.get(cid) ?? 0) + Number(row._sum.allocatedAmount ?? 0))
      );
    }

    const topCustomerIds = [...byCustomer.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const customers = await prisma.customer.findMany({
      where: { id: { in: topCustomerIds } },
      select: { id: true, arabicName: true },
    });
    const customerName = new Map(customers.map((c) => [c.id, c.arabicName]));

    const topClientsByCollection = topCustomerIds.map((id) => ({
      customerId: id,
      customerName: customerName.get(id) ?? id,
      collectedAmount: byCustomer.get(id) ?? 0,
    }));

    const [salesByCc, purchasesByCc, costCenters] = await Promise.all([
      prisma.invoice.groupBy({
        by: ['costCenterId'],
        where: {
          companyId: params.companyId,
          isPosted: true,
          invoiceKind: 'SALE',
          costCenterId: { not: null },
          date: { gte: start, lte: now },
          ...branchFilter,
        },
        _sum: { netAmount: true },
      }),
      prisma.invoice.groupBy({
        by: ['costCenterId'],
        where: {
          companyId: params.companyId,
          isPosted: true,
          invoiceKind: 'PURCHASE',
          costCenterId: { not: null },
          date: { gte: start, lte: now },
          ...branchFilter,
        },
        _sum: { netAmount: true },
      }),
      prisma.costCenter.findMany({
        where: { companyId: params.companyId, isActive: true },
        select: { id: true, arabicName: true, budget: true },
      }),
    ]);

    const ccMap = new Map(costCenters.map((c) => [c.id, c]));
    const revenueCc = new Map(
      salesByCc.map((r) => [r.costCenterId!, Number(r._sum.netAmount ?? 0)])
    );
    const costCc = new Map(
      purchasesByCc.map((r) => [r.costCenterId!, Number(r._sum.netAmount ?? 0)])
    );
    const ccIds = new Set([...revenueCc.keys(), ...costCc.keys()]);

    const costCenterRanking = [...ccIds]
      .map((id) => {
        const cc = ccMap.get(id);
        const revenue = roundTo4(revenueCc.get(id) ?? 0);
        const cost = roundTo4(costCc.get(id) ?? 0);
        const profit = roundTo4(revenue - cost);
        const budget = cc?.budget != null ? Number(cc.budget) : null;
        return {
          costCenterId: id,
          name: cc?.arabicName ?? id,
          revenue,
          cost,
          profit,
          budget,
          budgetUtilizationPct:
            budget != null && budget > 0 ? roundTo4((cost / budget) * 100) : null,
        };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8);

    const branches = await prisma.invoice.groupBy({
      by: ['branchId'],
      where: {
        companyId: params.companyId,
        isPosted: true,
        invoiceKind: 'SALE',
        date: { gte: start, lte: now },
      },
      _sum: { netAmount: true },
    });
    const branchIds = branches.map((b) => b.branchId).filter(Boolean) as string[];
    const branchRows = await prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, arabicName: true },
    });
    const branchName = new Map(branchRows.map((b) => [b.id, b.arabicName]));

    const branchHealth = branches
      .filter((b) => b.branchId)
      .map((b) => ({
        branchId: b.branchId,
        name: branchName.get(b.branchId!) ?? b.branchId,
        revenue: roundTo4(Number(b._sum.netAmount ?? 0)),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    return {
      topProfitableItems,
      topClientsByCollection,
      costCenterRanking,
      branchHealth,
      periodDays: 90,
    };
  }
}

function isAfterHoursCairo(d: Date): boolean {
  const h = (d.getUTCHours() + 2) % 24;
  return h >= 23 || h < 6;
}

function formatMoneyShort(value: number): string {
  return `${Math.round(value).toLocaleString('ar-EG')} ج.م`;
}

export const executiveDashboardService = new ExecutiveDashboardService();
