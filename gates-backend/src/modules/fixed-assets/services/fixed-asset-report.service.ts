import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { firstDepreciationMonth, projectSchedule } from '../domain/depreciation';
import { toDepreciable } from './fixed-asset.service';
import { accumulatedAtYearStart, isoDay, nextDepreciationMonth, num } from './fixed-asset-refs';

const r = roundTo4;

function endOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export class FixedAssetReportService {
  /** Totals for the module home page. */
  async summary(companyId: string) {
    const groups = await prisma.fixedAsset.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { _all: true },
      _sum: { cost: true, accumulatedDepreciation: true },
    });
    const byStatus = Object.fromEntries(
      groups.map((g) => [
        g.status,
        {
          count: g._count._all,
          cost: num(g._sum.cost),
          accumulated: num(g._sum.accumulatedDepreciation),
          bookValue: r(num(g._sum.cost) - num(g._sum.accumulatedDepreciation)),
        },
      ])
    );
    const inService = ['ACTIVE', 'FULLY_DEPRECIATED'].map((s) => byStatus[s]).filter(Boolean);
    const lastRun = await prisma.fixedAssetDepreciationRun.findFirst({
      where: { companyId, status: 'POSTED' },
      orderBy: { periodEnd: 'desc' },
      select: { runNumber: true, periodEnd: true, totalAmount: true },
    });
    return {
      byStatus,
      inService: {
        count: inService.reduce((s, g) => s + g.count, 0),
        cost: r(inService.reduce((s, g) => s + g.cost, 0)),
        accumulated: r(inService.reduce((s, g) => s + g.accumulated, 0)),
        bookValue: r(inService.reduce((s, g) => s + g.bookValue, 0)),
      },
      lastRun: lastRun
        ? { runNumber: lastRun.runNumber, periodEnd: isoDay(lastRun.periodEnd), totalAmount: num(lastRun.totalAmount) }
        : null,
    };
  }

  /** Posted depreciation so far plus the projected months still to come. */
  async schedule(companyId: string, assetId: string) {
    const asset = await prisma.fixedAsset.findFirst({ where: { id: assetId, companyId } });
    if (!asset) throw new AppError(404, 'الأصل غير موجود');
    const [posted, disposal] = await Promise.all([
      prisma.fixedAssetDepreciationLine.findMany({
        where: { assetId, run: { companyId, status: 'POSTED' } },
        orderBy: { periodMonth: 'asc' },
        include: { run: { select: { id: true, runNumber: true } } },
      }),
      prisma.fixedAssetDisposal.findFirst({ where: { companyId, assetId, status: 'POSTED' } }),
    ]);
    const cost = num(asset.cost);
    const actual = posted.map((line) => ({
      periodEnd: isoDay(line.periodMonth),
      amount: num(line.amount),
      accumulatedAfter: num(line.accumulatedAfter),
      bookValueAfter: r(cost - num(line.accumulatedAfter)),
      runId: line.run.id,
      runNumber: line.run.runNumber,
    }));

    let projected: Array<{ periodEnd: string | null; amount: number; accumulatedAfter: number; bookValueAfter: number }> = [];
    if (asset.status === 'ACTIVE' || asset.status === 'DRAFT') {
      const depreciable = toDepreciable(asset);
      const accumulated = asset.status === 'DRAFT' ? num(asset.openingAccumulatedDepreciation) : num(asset.accumulatedDepreciation);
      const through = asset.status === 'DRAFT' ? asset.openingDepreciatedThrough : asset.depreciatedThrough;
      const from = nextDepreciationMonth(through, firstDepreciationMonth(asset.inServiceDate));
      const yearStart =
        asset.status === 'DRAFT' ? accumulated : await accumulatedAtYearStart(prisma, asset, from);
      projected = projectSchedule(depreciable, from, { accumulated, accumulatedAtYearStart: yearStart }).map((l) => ({
        periodEnd: isoDay(l.periodEnd),
        amount: l.amount,
        accumulatedAfter: l.accumulatedAfter,
        bookValueAfter: l.bookValueAfter,
      }));
    }

    return {
      assetId,
      cost,
      salvageValue: num(asset.salvageValue),
      openingAccumulatedDepreciation: num(asset.openingAccumulatedDepreciation),
      openingDepreciatedThrough: isoDay(asset.openingDepreciatedThrough),
      actual,
      disposal: disposal
        ? {
            disposalNumber: disposal.disposalNumber,
            disposalDate: isoDay(disposal.disposalDate),
            catchUpDepreciation: num(disposal.catchUpDepreciation),
            catchUpMonths: disposal.catchUpMonths,
            gainLoss: num(disposal.gainLoss),
          }
        : null,
      projected,
    };
  }

  /**
   * Movement (roll-forward) by category for [from, to] — the EAS 10 disclosure
   * note: opening, additions, disposals and closing for cost and for
   * accumulated depreciation. Built from posted sub-ledger rows only.
   */
  async movement(companyId: string, fromInput: Date, toInput: Date, categoryId?: string) {
    const from = endOfDay(fromInput);
    const to = endOfDay(toInput);
    if (to < from) throw new AppError(422, 'تاريخ النهاية يسبق تاريخ البداية');

    const assets = await prisma.fixedAsset.findMany({
      where: {
        companyId,
        status: { not: 'DRAFT' },
        acquisitionDate: { lte: to },
        ...(categoryId ? { categoryId } : {}),
      },
      select: {
        id: true,
        categoryId: true,
        cost: true,
        acquisitionDate: true,
        openingAccumulatedDepreciation: true,
        openingDepreciatedThrough: true,
      },
    });
    const assetIds = assets.map((a) => a.id);
    const [before, within, disposals, categories] = await Promise.all([
      prisma.fixedAssetDepreciationLine.groupBy({
        by: ['assetId'],
        where: { assetId: { in: assetIds }, run: { companyId, status: 'POSTED' }, periodMonth: { lt: from } },
        _sum: { amount: true },
      }),
      prisma.fixedAssetDepreciationLine.groupBy({
        by: ['assetId'],
        where: {
          assetId: { in: assetIds },
          run: { companyId, status: 'POSTED' },
          periodMonth: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
      prisma.fixedAssetDisposal.findMany({
        where: { companyId, status: 'POSTED', assetId: { in: assetIds }, disposalDate: { lte: to } },
        select: { assetId: true, disposalDate: true, catchUpDepreciation: true, accumulatedAmount: true },
      }),
      prisma.fixedAssetCategory.findMany({
        where: { companyId },
        select: { id: true, code: true, arabicName: true },
      }),
    ]);
    const beforeBy = new Map(before.map((g) => [g.assetId, num(g._sum.amount)]));
    const withinBy = new Map(within.map((g) => [g.assetId, num(g._sum.amount)]));
    const disposalBy = new Map(disposals.map((d) => [d.assetId, d]));

    type Row = {
      categoryId: string;
      code: string;
      name: string;
      costOpening: number;
      costAdditions: number;
      costDisposals: number;
      costClosing: number;
      accOpening: number;
      accOnAdditions: number;
      accCharge: number;
      accDisposals: number;
      accClosing: number;
      bookValueOpening: number;
      bookValueClosing: number;
    };
    const catById = new Map(categories.map((c) => [c.id, c]));
    const rows = new Map<string, Row>();
    const rowFor = (id: string): Row => {
      let row = rows.get(id);
      if (!row) {
        const cat = catById.get(id);
        row = {
          categoryId: id,
          code: cat?.code ?? '',
          name: cat?.arabicName ?? '',
          costOpening: 0,
          costAdditions: 0,
          costDisposals: 0,
          costClosing: 0,
          accOpening: 0,
          accOnAdditions: 0,
          accCharge: 0,
          accDisposals: 0,
          accClosing: 0,
          bookValueOpening: 0,
          bookValueClosing: 0,
        };
        rows.set(id, row);
      }
      return row;
    };

    for (const asset of assets) {
      const disposal = disposalBy.get(asset.id);
      if (disposal && disposal.disposalDate < from) continue; // left before the period
      const row = rowFor(asset.categoryId);
      const cost = num(asset.cost);
      const opening = num(asset.openingAccumulatedDepreciation);
      const isAddition = asset.acquisitionDate >= from;
      const openingCounted = asset.openingDepreciatedThrough && asset.openingDepreciatedThrough < from && !isAddition;

      if (isAddition) {
        row.costAdditions = r(row.costAdditions + cost);
        row.accOnAdditions = r(row.accOnAdditions + opening);
      } else {
        row.costOpening = r(row.costOpening + cost);
        row.accOpening = r(row.accOpening + (openingCounted ? opening : 0) + (beforeBy.get(asset.id) ?? 0));
        if (!openingCounted) row.accOnAdditions = r(row.accOnAdditions + opening);
      }
      row.accCharge = r(row.accCharge + (withinBy.get(asset.id) ?? 0));
      if (disposal) {
        row.accCharge = r(row.accCharge + num(disposal.catchUpDepreciation));
        row.costDisposals = r(row.costDisposals + cost);
        row.accDisposals = r(row.accDisposals + num(disposal.accumulatedAmount));
      }
    }

    const out = [...rows.values()]
      .map((row) => {
        row.costClosing = r(row.costOpening + row.costAdditions - row.costDisposals);
        row.accClosing = r(row.accOpening + row.accOnAdditions + row.accCharge - row.accDisposals);
        row.bookValueOpening = r(row.costOpening - row.accOpening);
        row.bookValueClosing = r(row.costClosing - row.accClosing);
        return row;
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    const keys = [
      'costOpening',
      'costAdditions',
      'costDisposals',
      'costClosing',
      'accOpening',
      'accOnAdditions',
      'accCharge',
      'accDisposals',
      'accClosing',
      'bookValueOpening',
      'bookValueClosing',
    ] as const;
    const totals = Object.fromEntries(keys.map((k) => [k, r(out.reduce((s, row) => s + row[k], 0))]));
    return { from: isoDay(from), to: isoDay(to), rows: out, totals };
  }
}

export const fixedAssetReportService = new FixedAssetReportService();
