import type { AIProvider } from '../interfaces/ai-provider';
import {
  addDays,
  calendarDayLag,
  companyCashGap,
  displayUserName,
  isBackdated,
  isBelowReplacement,
  isHighVoidRate,
  isoDate,
  money,
  projectLocalGap,
  shouldFlagProject,
  suggestedSalePrice,
  voidRate,
} from './sentinel.math';
import type { SentinelPorts } from './sentinel.ports';
import type { SentinelSnapshotStore } from './sentinel.snapshot.store';
import { synthesizeSentinelNarrative, toCompactPayload } from './synthesize-sentinel';
import {
  CASHFLOW_HORIZON_DAYS,
  FRAUD_LOOKBACK_DAYS,
  REPLACEMENT_LOOKBACK_DAYS,
  SENTINEL_CACHE_MAX_AGE_MS,
  SHORTAGE_REPEAT_MIN,
  SHORTAGE_WINDOW_DAYS,
  type BackdatedInvoiceFlag,
  type ContractingCashGapFlag,
  type ReplacementCostFlag,
  type SentinelCashflowResult,
  type SentinelExecutiveReport,
  type SentinelFraudResult,
  type ShortageWriteoffFlag,
  type VoidPatternFlag,
} from './sentinel.types';

function inspectInvoice(invoiceId: string): string {
  return `/inventory/operations/sales-invoice?invoiceId=${encodeURIComponent(invoiceId)}`;
}

export class SentinelService {
  constructor(
    private readonly ports: SentinelPorts,
    private readonly provider: AIProvider,
    private readonly snapshots: SentinelSnapshotStore
  ) {}

  async detectFraudPatterns(companyId: string, asOf = new Date()): Promise<SentinelFraudResult> {
    const invoiceFrom = addDays(asOf, -FRAUD_LOOKBACK_DAYS);
    const shortageFrom = addDays(asOf, -SHORTAGE_WINDOW_DAYS);
    const [invoices, shortages] = await Promise.all([
      this.ports.listInvoices(companyId, invoiceFrom, asOf),
      this.ports.listShortageWriteoffs(companyId, shortageFrom),
    ]);

    const userIds = [
      ...new Set(invoices.map((row) => row.createdBy).filter((id): id is string => Boolean(id))),
    ];
    const users = await this.ports.listUsers(companyId, userIds);
    const userMap = new Map(users.map((user) => [user.id, displayUserName(user)]));

    const byUser = new Map<
      string,
      { cancelledVolume: number; totalVolume: number; cancelledCount: number; totalCount: number }
    >();
    for (const invoice of invoices) {
      const userId = invoice.createdBy;
      if (!userId) continue;
      const current = byUser.get(userId) ?? {
        cancelledVolume: 0,
        totalVolume: 0,
        cancelledCount: 0,
        totalCount: 0,
      };
      const volume = Math.abs(money(invoice.netAmount));
      current.totalVolume = money(current.totalVolume + volume);
      current.totalCount += 1;
      if (invoice.isCancelled) {
        current.cancelledVolume = money(current.cancelledVolume + volume);
        current.cancelledCount += 1;
      }
      byUser.set(userId, current);
    }

    const voidPatterns: VoidPatternFlag[] = [];
    for (const [userId, stats] of byUser) {
      const rate = voidRate(stats.cancelledVolume, stats.totalVolume);
      if (!isHighVoidRate(rate) || stats.totalCount < 2) continue;
      voidPatterns.push({
        type: 'VOID_PATTERN',
        severity: rate >= 0.15 ? 'crit' : 'warn',
        userId,
        userName: userMap.get(userId) ?? userId,
        cancelledVolume: stats.cancelledVolume,
        totalVolume: stats.totalVolume,
        voidRate: rate,
        cancelledCount: stats.cancelledCount,
        totalCount: stats.totalCount,
        inspectHref: '/inventory/operations/sales-invoice',
      });
    }
    voidPatterns.sort((a, b) => b.voidRate - a.voidRate);

    const backdated: BackdatedInvoiceFlag[] = invoices
      .filter((invoice) => isBackdated(invoice.createdAt, invoice.date))
      .map((invoice) => {
        const lagDays = calendarDayLag(invoice.createdAt, invoice.date);
        const severity: BackdatedInvoiceFlag['severity'] = lagDays >= 10 ? 'crit' : 'warn';
        return {
          type: 'BACKDATED_INVOICE' as const,
          severity,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber || invoice.id,
          userId: invoice.createdBy,
          userName: invoice.createdBy ? userMap.get(invoice.createdBy) ?? invoice.createdBy : 'غير محدد',
          invoiceDate: isoDate(invoice.date),
          createdAt: invoice.createdAt.toISOString(),
          lagDays,
          inspectHref: inspectInvoice(invoice.id),
        };
      })
      .sort((a, b) => b.lagDays - a.lagDays)
      .slice(0, 20);

    const byItem = new Map<string, ShortageWriteoffFlag>();
    for (const row of shortages) {
      const current = byItem.get(row.itemId) ?? {
        type: 'REPEATED_SHORTAGE' as const,
        severity: 'warn' as const,
        itemId: row.itemId,
        itemName: row.itemName,
        itemCode: row.itemCode,
        eventCount: 0,
        totalShortageQty: 0,
        windowDays: SHORTAGE_WINDOW_DAYS,
        inspectHref: '/inventory/operations/stocktaking',
      };
      current.eventCount += 1;
      current.totalShortageQty = money(current.totalShortageQty + row.shortageQty);
      byItem.set(row.itemId, current);
    }

    const shortageFlags = [...byItem.values()]
      .filter((row) => row.eventCount >= SHORTAGE_REPEAT_MIN)
      .map((row) => {
        const severity: ShortageWriteoffFlag['severity'] = row.eventCount >= 4 ? 'crit' : 'warn';
        return { ...row, severity };
      })
      .sort((a, b) => b.eventCount - a.eventCount || b.totalShortageQty - a.totalShortageQty)
      .slice(0, 30);

    return { voidPatterns, backdated, shortages: shortageFlags };
  }

  async calculateReplacementCostGaps(
    companyId: string,
    asOf = new Date()
  ): Promise<ReplacementCostFlag[]> {
    const from = addDays(asOf, -REPLACEMENT_LOOKBACK_DAYS);
    const sales = await this.ports.listRecentSaleLines(companyId, from);
    const itemIds = [...new Set(sales.map((row) => row.itemId))];
    const purchases = await this.ports.listLatestPurchasePrices(companyId, itemIds);
    const latest = new Map<string, number>();
    for (const row of purchases) {
      if (latest.has(row.itemId)) continue;
      if (row.unitPrice > 0) latest.set(row.itemId, row.unitPrice);
    }

    const flags: ReplacementCostFlag[] = [];
    for (const sale of sales) {
      const replacementCost = latest.get(sale.itemId) || sale.lastPurchasePrice;
      if (!isBelowReplacement(sale.salePrice, replacementCost)) continue;
      const soldAboveAverageCost = sale.salePrice >= sale.averageCost;
      flags.push({
        type: 'BELOW_REPLACEMENT',
        severity: soldAboveAverageCost ? 'warn' : 'crit',
        itemId: sale.itemId,
        itemName: sale.itemName,
        invoiceId: sale.invoiceId,
        invoiceNumber: sale.invoiceNumber || sale.invoiceId,
        salePrice: sale.salePrice,
        replacementCost,
        averageCost: sale.averageCost,
        suggestedSalePrice: suggestedSalePrice(replacementCost),
        soldAboveAverageCost,
        inspectHref: inspectInvoice(sale.invoiceId),
      });
    }

    return flags
      .sort((a, b) => b.replacementCost - b.salePrice - (a.replacementCost - a.salePrice))
      .slice(0, 40);
  }

  async predictContractingCashflowGaps(
    companyId: string,
    asOf = new Date()
  ): Promise<SentinelCashflowResult> {
    const to = addDays(asOf, CASHFLOW_HORIZON_DAYS);
    const [subs, owners, cash] = await Promise.all([
      this.ports.listPendingSubcontractorCertificates(companyId, to),
      this.ports.listApprovedOwnerCertificates(companyId, asOf, to),
      this.ports.liquidCash(companyId),
    ]);

    const liquidTreasury = money(cash.treasuryTotal);
    const liquidBank = money(cash.bankTotal);
    const liquidTotal = money(liquidTreasury + liquidBank);

    const byProject = new Map<
      string,
      { projectName: string; projectCode: string; subDue: number; ownerDue: number }
    >();
    for (const row of subs) {
      const current = byProject.get(row.projectId) ?? {
        projectName: row.projectName,
        projectCode: row.projectCode,
        subDue: 0,
        ownerDue: 0,
      };
      current.subDue = money(current.subDue + row.netPayable);
      byProject.set(row.projectId, current);
    }
    for (const row of owners) {
      const current = byProject.get(row.projectId) ?? {
        projectName: row.projectName,
        projectCode: row.projectCode,
        subDue: 0,
        ownerDue: 0,
      };
      current.ownerDue = money(current.ownerDue + row.netAmount);
      byProject.set(row.projectId, current);
    }

    const totalSubcontractorDue21d = money(
      [...byProject.values()].reduce((sum, row) => sum + row.subDue, 0)
    );
    const totalOwnerInflow21d = money(
      [...byProject.values()].reduce((sum, row) => sum + row.ownerDue, 0)
    );
    const companyGap = companyCashGap(totalSubcontractorDue21d, totalOwnerInflow21d, liquidTotal);

    const projects: ContractingCashGapFlag[] = [];
    for (const [projectId, row] of byProject) {
      const gap = projectLocalGap(row.subDue, row.ownerDue);
      if (!shouldFlagProject(gap, companyGap)) continue;
      projects.push({
        type: 'CONTRACTING_CASH_GAP',
        severity: gap >= liquidTotal && liquidTotal > 0 ? 'crit' : 'warn',
        projectId,
        projectName: row.projectName,
        projectCode: row.projectCode,
        subcontractorDue21d: row.subDue,
        ownerInflow21d: row.ownerDue,
        liquidAvailable: liquidTotal,
        gap,
        inspectHref: '/contracting',
      });
    }
    projects.sort((a, b) => b.gap - a.gap);

    return {
      liquidBank,
      liquidTreasury,
      liquidTotal,
      totalSubcontractorDue21d,
      totalOwnerInflow21d,
      companyGap,
      horizonDays: CASHFLOW_HORIZON_DAYS,
      projects,
    };
  }

  async buildExecutiveReport(
    companyId: string,
    asOf = new Date(),
    source: SentinelExecutiveReport['source'] = 'live'
  ): Promise<SentinelExecutiveReport> {
    const [fraud, replacement, cashflow] = await Promise.all([
      this.detectFraudPatterns(companyId, asOf),
      this.calculateReplacementCostGaps(companyId, asOf),
      this.predictContractingCashflowGaps(companyId, asOf),
    ]);

    const compact = toCompactPayload({
      asOf: isoDate(asOf),
      fraud,
      replacement,
      cashflow,
    });
    const synthesized = await synthesizeSentinelNarrative(this.provider, compact);

    return {
      generatedAt: asOf.toISOString(),
      asOf: isoDate(asOf),
      source,
      narrative: synthesized.narrative,
      narrativeSource: synthesized.source,
      model: synthesized.model,
      counts: compact.counts,
      fraud,
      replacement,
      cashflow,
    };
  }

  async getExecutiveReport(
    companyId: string,
    asOf = new Date()
  ): Promise<SentinelExecutiveReport> {
    const cached = await this.snapshots.get(companyId);
    if (cached && asOf.getTime() - cached.generatedAt.getTime() <= SENTINEL_CACHE_MAX_AGE_MS) {
      return { ...cached.payload, source: 'cache' };
    }
    const live = await this.buildExecutiveReport(companyId, asOf, 'live');
    await this.snapshots.upsert(companyId, live);
    return live;
  }

  async runScheduledScan(companyId: string, asOf = new Date()): Promise<SentinelExecutiveReport> {
    const report = await this.buildExecutiveReport(companyId, asOf, 'scheduled');
    await this.snapshots.upsert(companyId, report);
    return report;
  }
}
