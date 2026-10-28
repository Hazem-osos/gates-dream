import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { autoGlPostingService } from '../../accounting/services/auto-gl-posting.service';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { journalLines } from '../../trade/utils/journal-lines.util';
import {
  depreciateMonths,
  firstDepreciationMonth,
  isFullyDepreciated,
  monthEndDate,
  monthKey,
} from '../domain/depreciation';
import { toDepreciable } from './fixed-asset.service';
import {
  FIXED_ASSET_JOURNAL_SOURCE,
  accumulatedAtYearStart,
  companyCurrency,
  describeJournalLines,
  isoDay,
  lockAssetsInTx,
  nextDepreciationMonth,
  num,
} from './fixed-asset-refs';

type Db = Prisma.TransactionClient | typeof prisma;

/** Large runs touch one row per asset; give them room. */
const RUN_TX_OPTIONS = { timeout: 180_000, maxWait: 15_000 } as const;

export interface RunLineDraft {
  assetId: string;
  assetCode: string;
  assetName: string;
  periodMonth: Date;
  amount: number;
  accumulatedAfter: number;
  depreciationExpenseAccountId: string;
  accumulatedDepreciationAccountId: string;
  costCenterId: string | null;
}

function periodKey(companyId: string, month: number): string {
  const end = monthEndDate(month);
  return `${companyId}:${end.toISOString().slice(0, 7)}`;
}

export class FixedAssetDepreciationService {
  /** Depreciation for every eligible asset through `periodMonth` (no writes). */
  private async computeLines(db: Db, companyId: string, periodMonth: number, assetIds?: string[]) {
    const assets = await db.fixedAsset.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        depreciationMethod: { not: 'NONE' },
        ...(assetIds ? { id: { in: assetIds } } : {}),
      },
      orderBy: { code: 'asc' },
    });
    const lines: RunLineDraft[] = [];
    const perAsset = new Map<string, { amount: number; accumulated: number; fully: boolean }>();
    for (const asset of assets) {
      const first = firstDepreciationMonth(asset.inServiceDate);
      const from = nextDepreciationMonth(asset.depreciatedThrough, first);
      if (from > periodMonth) continue;
      const yearStart = await accumulatedAtYearStart(db, asset, from);
      const depreciable = toDepreciable(asset);
      const { lines: months, state } = depreciateMonths(depreciable, from, periodMonth, {
        accumulated: num(asset.accumulatedDepreciation),
        accumulatedAtYearStart: yearStart,
      });
      if (months.length === 0) continue;
      for (const month of months) {
        lines.push({
          assetId: asset.id,
          assetCode: asset.code,
          assetName: asset.arabicName,
          periodMonth: month.periodEnd,
          amount: month.amount,
          accumulatedAfter: month.accumulatedAfter,
          depreciationExpenseAccountId: asset.depreciationExpenseAccountId,
          accumulatedDepreciationAccountId: asset.accumulatedDepreciationAccountId,
          costCenterId: asset.costCenterId,
        });
      }
      perAsset.set(asset.id, {
        amount: roundTo4(months.reduce((sum, m) => sum + m.amount, 0)),
        accumulated: state.accumulated,
        fully: isFullyDepreciated(depreciable, state.accumulated),
      });
    }
    return { lines, perAsset };
  }

  /** Journal lines: debit expense per (account, cost center), credit accumulated per account. */
  private journalFor(lines: RunLineDraft[], label: string) {
    const debit = new Map<string, { accountId: string; costCenterId: string | null; amount: number }>();
    const credit = new Map<string, number>();
    for (const line of lines) {
      const key = `${line.depreciationExpenseAccountId}|${line.costCenterId ?? ''}`;
      const row = debit.get(key) ?? {
        accountId: line.depreciationExpenseAccountId,
        costCenterId: line.costCenterId,
        amount: 0,
      };
      row.amount = roundTo4(row.amount + line.amount);
      debit.set(key, row);
      credit.set(
        line.accumulatedDepreciationAccountId,
        roundTo4((credit.get(line.accumulatedDepreciationAccountId) ?? 0) + line.amount)
      );
    }
    return journalLines([
      ...[...debit.values()].map((row) => ({
        accountId: row.accountId,
        debit: row.amount,
        credit: 0,
        description: `مصروف إهلاك ${label}`,
        ...(row.costCenterId ? { costCenterId: row.costCenterId } : {}),
      })),
      ...[...credit.entries()].map(([accountId, amount]) => ({
        accountId,
        debit: 0,
        credit: amount,
        description: `مجمع إهلاك ${label}`,
      })),
    ]);
  }

  private async assertSequence(db: Db, companyId: string, periodMonth: number, runId?: string) {
    const latest = await db.fixedAssetDepreciationRun.findFirst({
      where: { companyId, status: 'POSTED', ...(runId ? { NOT: { id: runId } } : {}) },
      orderBy: { periodEnd: 'desc' },
      select: { periodEnd: true, runNumber: true },
    });
    if (latest && monthKey(latest.periodEnd) >= periodMonth) {
      throw new AppError(
        409,
        `آخر إهلاك مرحل حتى ${isoDay(latest.periodEnd)} (رقم ${latest.runNumber}). الإهلاك يُرحل بالتتابع لشهر لاحق فقط`
      );
    }
    const pending = await db.fixedAssetDepreciationRun.findFirst({
      where: { companyId, status: 'UNPOSTED', ...(runId ? { NOT: { id: runId } } : {}) },
      select: { runNumber: true, periodEnd: true },
    });
    if (pending) {
      throw new AppError(
        409,
        `يوجد تشغيل إهلاك غير مرحل رقم ${pending.runNumber} عن ${isoDay(pending.periodEnd)}: أعد ترحيله أو احذفه أولًا`
      );
    }
  }

  async preview(companyId: string, periodEnd: Date) {
    const periodMonth = monthKey(periodEnd);
    const pending = await prisma.fixedAssetDepreciationRun.findFirst({
      where: { companyId, status: 'UNPOSTED', periodEnd: monthEndDate(periodMonth) },
      select: { id: true },
    });
    await this.assertSequence(prisma, companyId, periodMonth, pending?.id);
    const { lines } = await this.computeLines(prisma, companyId, periodMonth);
    const byAsset = new Map<string, { assetId: string; code: string; name: string; months: number; amount: number; accumulatedAfter: number }>();
    for (const line of lines) {
      const row = byAsset.get(line.assetId) ?? {
        assetId: line.assetId,
        code: line.assetCode,
        name: line.assetName,
        months: 0,
        amount: 0,
        accumulatedAfter: 0,
      };
      row.months += 1;
      row.amount = roundTo4(row.amount + line.amount);
      row.accumulatedAfter = line.accumulatedAfter;
      byAsset.set(line.assetId, row);
    }
    const journal = lines.length
      ? await describeJournalLines(prisma, companyId, this.journalFor(lines, ''))
      : [];
    return {
      periodEnd: isoDay(monthEndDate(periodMonth)),
      assets: [...byAsset.values()],
      totalAmount: roundTo4(lines.reduce((sum, l) => sum + l.amount, 0)),
      journal,
    };
  }

  /**
   * Post depreciation through the month of `periodEnd`. Reposting an unposted
   * run for the same month reuses the run and its journal (same number).
   */
  async post(ctx: JournalPostingContext, periodEnd: Date, notes?: string | null) {
    const { companyId } = ctx;
    const periodMonth = monthKey(periodEnd);
    const runDate = monthEndDate(periodMonth);
    const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, runDate);
    const currency = await companyCurrency(prisma, companyId);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.fixedAssetDepreciationRun.findFirst({
        where: { companyId, status: 'UNPOSTED', periodEnd: runDate },
      });

      const candidates = await tx.fixedAsset.findMany({
        where: { companyId, status: 'ACTIVE', depreciationMethod: { not: 'NONE' } },
        select: { id: true },
      });
      await lockAssetsInTx(tx, companyId, candidates.map((c) => c.id));
      await this.assertSequence(tx, companyId, periodMonth, existing?.id);

      const { lines, perAsset } = await this.computeLines(
        tx,
        companyId,
        periodMonth,
        candidates.map((c) => c.id)
      );
      if (lines.length === 0) {
        throw new AppError(422, 'لا يوجد إهلاك مستحق حتى هذا الشهر');
      }
      const total = roundTo4(lines.reduce((sum, l) => sum + l.amount, 0));

      let run;
      if (existing) {
        const { count } = await tx.fixedAssetDepreciationRun.updateMany({
          where: { id: existing.id, companyId, status: 'UNPOSTED' },
          data: {
            status: 'POSTED',
            activePeriodKey: periodKey(companyId, periodMonth),
            totalAmount: new Decimal(total),
            notes: notes ?? existing.notes,
            postedAt: new Date(),
            postedBy: ctx.userId,
          },
        });
        if (count !== 1) throw new AppError(409, 'تغيرت حالة تشغيل الإهلاك، أعد المحاولة');
        await tx.fixedAssetDepreciationLine.deleteMany({ where: { runId: existing.id } });
        run = { ...existing, totalAmount: new Decimal(total) };
      } else {
        const runNumber = await documentSequenceService.nextNumberInTx(tx, {
          companyId,
          branchId: null,
          fiscalYearId: null,
          docType: 'FADEP',
          scope: 'C',
          padding: 6,
          isAvailable: async (candidate) =>
            !(await tx.fixedAssetDepreciationRun.findFirst({
              where: { companyId, runNumber: candidate },
              select: { id: true },
            })),
        });
        // The unique activePeriodKey rejects a concurrent second post of this month.
        run = await tx.fixedAssetDepreciationRun.create({
          data: {
            companyId,
            runNumber,
            periodEnd: runDate,
            status: 'POSTED',
            activePeriodKey: periodKey(companyId, periodMonth),
            totalAmount: new Decimal(total),
            branchId: ctx.branchId ?? null,
            notes: notes ?? null,
            postedAt: new Date(),
            postedBy: ctx.userId,
            createdBy: ctx.userId,
          },
        });
      }

      await tx.fixedAssetDepreciationLine.createMany({
        data: lines.map((line) => ({
          runId: run.id,
          assetId: line.assetId,
          periodMonth: line.periodMonth,
          amount: new Decimal(line.amount),
          accumulatedAfter: new Decimal(line.accumulatedAfter),
          depreciationExpenseAccountId: line.depreciationExpenseAccountId,
          accumulatedDepreciationAccountId: line.accumulatedDepreciationAccountId,
          costCenterId: line.costCenterId,
        })),
      });

      for (const [assetId, result] of perAsset) {
        const { count } = await tx.fixedAsset.updateMany({
          where: { id: assetId, companyId, status: 'ACTIVE' },
          data: {
            accumulatedDepreciation: { increment: new Decimal(result.amount) },
            depreciatedThrough: runDate,
            status: result.fully ? 'FULLY_DEPRECIATED' : 'ACTIVE',
            version: { increment: 1 },
          },
        });
        if (count !== 1) throw new AppError(409, 'تغيرت حالة أحد الأصول أثناء الإهلاك، أعد المحاولة');
      }

      const label = `${run.runNumber} حتى ${isoDay(runDate)}`;
      const journal = await autoGlPostingService.commitInTx(tx, ctx, {
        sourceType: FIXED_ASSET_JOURNAL_SOURCE,
        sourceId: run.id,
        existingJournalId: run.journalEntryId,
        sourceNumber: run.runNumber,
        date: runDate,
        description: `إهلاك الأصول الثابتة ${label}`,
        currencyCode: currency,
        exchangeRate: 1,
        fiscalYearId,
        entryType: 'FA-DEPRECIATION',
        requireAutoPostFlag: false,
        lines: this.journalFor(lines, label),
      });
      if (!journal) throw new AppError(500, 'تعذر إنشاء قيد الإهلاك');
      await tx.fixedAssetDepreciationRun.updateMany({
        where: { id: run.id, companyId },
        data: { journalEntryId: journal.id },
      });
      return tx.fixedAssetDepreciationRun.findFirstOrThrow({ where: { id: run.id, companyId } });
    }, RUN_TX_OPTIONS);
  }

  /** Unpost in place — only the latest posted run, and only if none of its assets left since. */
  async unpost(ctx: JournalPostingContext, runId: string) {
    const { companyId } = ctx;
    return prisma.$transaction(async (tx) => {
      const run = await tx.fixedAssetDepreciationRun.findFirst({ where: { id: runId, companyId } });
      if (!run) throw new AppError(404, 'تشغيل الإهلاك غير موجود');
      if (run.status !== 'POSTED') throw new AppError(409, 'التشغيل غير مرحل');
      const later = await tx.fixedAssetDepreciationRun.findFirst({
        where: { companyId, status: 'POSTED', periodEnd: { gt: run.periodEnd } },
        select: { runNumber: true },
      });
      if (later) throw new AppError(409, `ألغِ ترحيل التشغيل الأحدث رقم ${later.runNumber} أولًا`);

      const lines = await tx.fixedAssetDepreciationLine.findMany({ where: { runId: run.id } });
      const assetIds = [...new Set(lines.map((l) => l.assetId))];
      await lockAssetsInTx(tx, companyId, assetIds);
      const assets = await tx.fixedAsset.findMany({ where: { companyId, id: { in: assetIds } } });
      const disposed = assets.find((a) => a.status === 'DISPOSED');
      if (disposed) {
        throw new AppError(409, `الأصل ${disposed.code} مستبعد بعد هذا الإهلاك؛ ألغِ ترحيل الاستبعاد أولًا`);
      }

      // Claim first: only one request flips POSTED → UNPOSTED and restores the assets.
      const { count } = await tx.fixedAssetDepreciationRun.updateMany({
        where: { id: run.id, companyId, status: 'POSTED' },
        data: { status: 'UNPOSTED', activePeriodKey: null, postedAt: null, postedBy: null },
      });
      if (count !== 1) throw new AppError(409, 'التشغيل غير مرحل');

      for (const asset of assets) {
        const own = lines.filter((l) => l.assetId === asset.id);
        const amount = roundTo4(own.reduce((sum, l) => sum + num(l.amount), 0));
        const firstMonth = Math.min(...own.map((l) => monthKey(l.periodMonth)));
        const earlier = await tx.fixedAssetDepreciationLine.count({
          where: {
            assetId: asset.id,
            run: { status: 'POSTED', companyId },
            periodMonth: { lt: monthEndDate(firstMonth) },
          },
        });
        const restoredThrough = earlier > 0 ? monthEndDate(firstMonth - 1) : asset.openingDepreciatedThrough;
        const accumulated = roundTo4(num(asset.accumulatedDepreciation) - amount);
        const { count: updated } = await tx.fixedAsset.updateMany({
          where: { id: asset.id, companyId, status: { in: ['ACTIVE', 'FULLY_DEPRECIATED'] } },
          data: {
            accumulatedDepreciation: { decrement: new Decimal(amount) },
            depreciatedThrough: restoredThrough,
            status: isFullyDepreciated(toDepreciable(asset), accumulated) ? 'FULLY_DEPRECIATED' : 'ACTIVE',
            version: { increment: 1 },
          },
        });
        if (updated !== 1) throw new AppError(409, `تغيرت حالة الأصل ${asset.code}، أعد المحاولة`);
      }

      if (run.journalEntryId) {
        await journalPostingService.unpostSourceJournalInTx(tx, ctx, run.journalEntryId);
      }
      return tx.fixedAssetDepreciationRun.findFirstOrThrow({ where: { id: run.id, companyId } });
    }, RUN_TX_OPTIONS);
  }

  async repost(ctx: JournalPostingContext, runId: string) {
    const run = await prisma.fixedAssetDepreciationRun.findFirst({ where: { id: runId, companyId: ctx.companyId } });
    if (!run) throw new AppError(404, 'تشغيل الإهلاك غير موجود');
    if (run.status !== 'UNPOSTED') throw new AppError(409, 'التشغيل مرحل بالفعل');
    return this.post(ctx, run.periodEnd, run.notes);
  }

  /** Delete an unposted run; its journal is cancelled, never reversed. */
  async remove(ctx: JournalPostingContext, runId: string) {
    const { companyId } = ctx;
    return prisma.$transaction(async (tx) => {
      const run = await tx.fixedAssetDepreciationRun.findFirst({ where: { id: runId, companyId } });
      if (!run) throw new AppError(404, 'تشغيل الإهلاك غير موجود');
      const { count } = await tx.fixedAssetDepreciationRun.deleteMany({
        where: { id: run.id, companyId, status: 'UNPOSTED' },
      });
      if (count !== 1) throw new AppError(409, 'ألغِ ترحيل التشغيل قبل حذفه');
      if (run.journalEntryId) {
        await journalPostingService.cascadeSourceJournalInTx(tx, companyId, [run.journalEntryId], 'cancel', ctx.userId);
      }
      return { id: run.id };
    });
  }

  async list(companyId: string) {
    return prisma.fixedAssetDepreciationRun.findMany({
      where: { companyId },
      orderBy: { periodEnd: 'desc' },
      include: { _count: { select: { lines: true } } },
      take: 500,
    });
  }

  async getById(companyId: string, id: string) {
    const run = await prisma.fixedAssetDepreciationRun.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          orderBy: [{ periodMonth: 'asc' }],
          include: { asset: { select: { id: true, code: true, arabicName: true } } },
        },
      },
    });
    if (!run) throw new AppError(404, 'تشغيل الإهلاك غير موجود');
    const journal = run.journalEntryId
      ? await prisma.journalEntry.findFirst({
          where: { id: run.journalEntryId, companyId },
          select: { id: true, voucherNumber: true, isPosted: true, isCancelled: true },
        })
      : null;
    return { ...run, journal };
  }
}

export const fixedAssetDepreciationService = new FixedAssetDepreciationService();
