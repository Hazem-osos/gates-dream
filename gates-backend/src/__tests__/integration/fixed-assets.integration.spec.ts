/**
 * Fixed assets on real MySQL: purchase posting, monthly depreciation with
 * catch-up, in-place unpost/repost, sale with gain, and the concurrency
 * guarantees (a double click never posts twice).
 *
 * Needs the disposable local MySQL (infra/docker-compose.local-dev-mysql.yml)
 * with the fixed_assets_module migration applied.
 */
import prisma from '../../shared/database/prisma';
import type { JournalPostingContext } from '../../modules/accounting/services/journal-posting.service';
import { fixedAssetCategoryService } from '../../modules/fixed-assets/services/fixed-asset-category.service';
import { fixedAssetService } from '../../modules/fixed-assets/services/fixed-asset.service';
import { fixedAssetDepreciationService } from '../../modules/fixed-assets/services/fixed-asset-depreciation.service';
import { fixedAssetDisposalService } from '../../modules/fixed-assets/services/fixed-asset-disposal.service';
import { fixedAssetReportService } from '../../modules/fixed-assets/services/fixed-asset-report.service';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

type Accounts = Record<'asset' | 'accumulated' | 'expense' | 'gain' | 'loss' | 'cash' | 'clearing', string>;

async function journalTotals(companyId: string, journalId: string) {
  const je = await prisma.journalEntry.findFirstOrThrow({
    where: { id: journalId, companyId },
    include: { lines: true },
  });
  const byAccount = new Map<string, number>();
  for (const l of je.lines) {
    const net = Number(l.debitBase ?? l.debit ?? 0) - Number(l.creditBase ?? l.credit ?? 0);
    byAccount.set(l.accountId, Math.round(((byAccount.get(l.accountId) ?? 0) + net) * 10000) / 10000);
  }
  return {
    isPosted: je.isPosted,
    isCancelled: je.isCancelled,
    voucherNumber: je.voucherNumber,
    debit: je.lines.reduce((s, l) => s + Number(l.debitBase ?? l.debit ?? 0), 0),
    credit: je.lines.reduce((s, l) => s + Number(l.creditBase ?? l.credit ?? 0), 0),
    net: (accountId: string) => byAccount.get(accountId) ?? 0,
  };
}

const statusOf = (r: PromiseSettledResult<unknown>) =>
  r.status === 'rejected' ? (r.reason as { statusCode?: number; code?: string }).statusCode ?? (r.reason as { code?: string }).code : 'ok';

describe('fixed assets — posting lifecycle on MySQL', () => {
  let companyId: string;
  let ctx: JournalPostingContext;
  let acc: Accounts;
  let categoryId: string;
  let assetId: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const company = await prisma.company.create({ data: { arabicName: `FA ${suffix}`, isActive: true } });
    companyId = company.id;
    const branch = await prisma.branch.create({ data: { companyId, arabicName: `Main ${suffix}` } });
    const fiscalYear = await prisma.fiscalYear.create({
      data: {
        companyId,
        legacyYearId: '2026',
        startDate: d('2026-01-01'),
        endDate: d('2026-12-31'),
        status: 'Open',
        isActive: true,
      },
    });
    const make = async (code: string, accountType: string, name: string) =>
      (await prisma.account.create({ data: { companyId, code, arabicName: name, accountType, isActive: true } })).id;
    acc = {
      asset: await make('1210', 'asset', 'Vehicles'),
      accumulated: await make('1290', 'asset', 'Accumulated depreciation'),
      expense: await make('5260', 'expense', 'Depreciation expense'),
      gain: await make('4800', 'revenue', 'Gain on disposal'),
      loss: await make('5800', 'expense', 'Loss on disposal'),
      cash: await make('1110', 'asset', 'Cash'),
      clearing: await make('1299', 'asset', 'Assets under settlement'),
    };
    ctx = { companyId, branchId: branch.id, userId: 'fa-test', fiscalYearId: fiscalYear.id, isAdmin: true };

    const category = await fixedAssetCategoryService.create(companyId, {
      code: 'VEH',
      arabicName: 'Vehicles',
      englishName: null,
      parentId: null,
      depreciationMethod: 'STRAIGHT_LINE',
      usefulLifeMonths: 12,
      decliningRate: null,
      salvagePercent: 0,
      assetAccountId: acc.asset,
      accumulatedDepreciationAccountId: acc.accumulated,
      depreciationExpenseAccountId: acc.expense,
      disposalGainAccountId: acc.gain,
      disposalLossAccountId: acc.loss,
      isActive: true,
    });
    categoryId = category.id;
  });

  it('creates a draft with category defaults and activates it exactly once (purchase journal)', async () => {
    const draft = await fixedAssetService.create(ctx, {
      arabicName: 'Truck',
      categoryId,
      acquisitionType: 'PURCHASE',
      acquisitionDate: d('2026-01-05'),
      inServiceDate: d('2026-01-10'),
      cost: 12000,
      vatAmount: 0,
      openingAccumulatedDepreciation: 0,
      creditAccountId: acc.clearing,
    } as never);
    assetId = draft.id;
    expect(draft.status).toBe('DRAFT');
    expect(draft.usefulLifeMonths).toBe(12);
    expect(draft.code).toMatch(/\d+/);

    const results = await Promise.allSettled([
      fixedAssetService.activate(ctx, assetId),
      fixedAssetService.activate(ctx, assetId),
    ]);
    expect(results.map(statusOf).sort()).toEqual([409, 'ok'].sort());

    const asset = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } });
    expect(asset.status).toBe('ACTIVE');
    const je = await journalTotals(companyId, asset.journalEntryId!);
    expect(je.isPosted).toBe(true);
    expect(je.debit).toBeCloseTo(je.credit, 4);
    expect(je.net(acc.asset)).toBeCloseTo(12000, 4);
    expect(je.net(acc.clearing)).toBeCloseTo(-12000, 4);
    const journals = await prisma.journalEntry.count({ where: { companyId, isCancelled: false } });
    expect(journals).toBe(1);
  });

  it('refuses cost changes once active', async () => {
    const asset = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } });
    await expect(
      fixedAssetService.update(ctx, assetId, { cost: 15000, version: asset.version } as never)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  let runId: string;
  let runJournalId: string;

  it('posts depreciation with catch-up once, even when posted twice at the same time', async () => {
    const preview = await fixedAssetDepreciationService.preview(companyId, d('2026-03-31'));
    expect(preview.totalAmount).toBeCloseTo(3000, 4);

    const results = await Promise.allSettled([
      fixedAssetDepreciationService.post(ctx, d('2026-03-31')),
      fixedAssetDepreciationService.post(ctx, d('2026-03-15')),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const runs = await prisma.fixedAssetDepreciationRun.findMany({ where: { companyId, status: 'POSTED' } });
    expect(runs).toHaveLength(1);
    runId = runs[0].id;
    runJournalId = runs[0].journalEntryId!;
    const lines = await prisma.fixedAssetDepreciationLine.findMany({ where: { runId } });
    expect(lines).toHaveLength(3); // Jan, Feb, Mar

    const asset = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } });
    expect(Number(asset.accumulatedDepreciation)).toBeCloseTo(3000, 4);
    expect(asset.depreciatedThrough?.toISOString().slice(0, 10)).toBe('2026-03-31');

    const je = await journalTotals(companyId, runJournalId);
    expect(je.isPosted).toBe(true);
    expect(je.net(acc.expense)).toBeCloseTo(3000, 4);
    expect(je.net(acc.accumulated)).toBeCloseTo(-3000, 4);
  });

  it('rejects a run for a month already depreciated', async () => {
    await expect(fixedAssetDepreciationService.post(ctx, d('2026-02-28'))).rejects.toMatchObject({ statusCode: 409 });
  });

  it('unposts in place and reposts on the same journal number', async () => {
    const before = await journalTotals(companyId, runJournalId);
    await fixedAssetDepreciationService.unpost(ctx, runId);

    let asset = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } });
    expect(Number(asset.accumulatedDepreciation)).toBeCloseTo(0, 4);
    expect(asset.depreciatedThrough).toBeNull();
    const unposted = await journalTotals(companyId, runJournalId);
    expect(unposted.isPosted).toBe(false);
    expect(unposted.isCancelled).toBe(false);
    // No reversal entry is ever booked.
    expect(await prisma.journalEntry.count({ where: { companyId, entryType: 'REVERSAL' } })).toBe(0);

    const reposted = await fixedAssetDepreciationService.repost(ctx, runId);
    expect(reposted.id).toBe(runId);
    expect(reposted.journalEntryId).toBe(runJournalId);
    const again = await journalTotals(companyId, runJournalId);
    expect(again.isPosted).toBe(true);
    expect(again.voucherNumber).toBe(before.voucherNumber);
    asset = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } });
    expect(Number(asset.accumulatedDepreciation)).toBeCloseTo(3000, 4);
  });

  let disposalId: string;

  it('sells the asset once: catch-up depreciation, gain, and the asset leaves service', async () => {
    const body = {
      assetId,
      disposalType: 'SALE' as const,
      disposalDate: d('2026-05-20'), // after the 15th → May depreciates
      proceeds: 9500,
      vatAmount: 0,
      proceedsAccountId: acc.cash,
      customerId: null,
      notes: null,
    };
    const preview = await fixedAssetDisposalService.preview(companyId, body);
    expect(preview.catchUpDepreciation).toBeCloseTo(2000, 4); // Apr + May
    expect(preview.bookValue).toBeCloseTo(7000, 4);
    expect(preview.gainLoss).toBeCloseTo(2500, 4);

    const results = await Promise.allSettled([
      fixedAssetDisposalService.post(ctx, body),
      fixedAssetDisposalService.post(ctx, body),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const posted = (results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ id: string; journalEntryId: string | null }>).value;
    disposalId = posted.id;

    const asset = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } });
    expect(asset.status).toBe('DISPOSED');
    expect(Number(asset.accumulatedDepreciation)).toBeCloseTo(5000, 4);

    const je = await journalTotals(companyId, posted.journalEntryId!);
    expect(je.debit).toBeCloseTo(je.credit, 4);
    expect(je.net(acc.asset)).toBeCloseTo(-12000, 4);
    expect(je.net(acc.cash)).toBeCloseTo(9500, 4);
    expect(je.net(acc.gain)).toBeCloseTo(-2500, 4);
    expect(je.net(acc.expense)).toBeCloseTo(2000, 4);
    // Catch-up credits 2000, closing debits 5000 → net debit 3000 (what the run had credited).
    expect(je.net(acc.accumulated)).toBeCloseTo(3000, 4);

    // A disposed asset is never depreciated again.
    await expect(fixedAssetDepreciationService.post(ctx, d('2026-06-30'))).rejects.toMatchObject({ statusCode: 422 });
    // And the run it depended on cannot be unposted underneath it.
    await expect(fixedAssetDepreciationService.unpost(ctx, runId)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('the movement report rolls forward and ties to the sub-ledger', async () => {
    const report = await fixedAssetReportService.movement(companyId, d('2026-01-01'), d('2026-12-31'));
    expect(report.totals.costAdditions).toBeCloseTo(12000, 4);
    expect(report.totals.costDisposals).toBeCloseTo(12000, 4);
    expect(report.totals.costClosing).toBeCloseTo(0, 4);
    expect(report.totals.accCharge).toBeCloseTo(5000, 4);
    expect(report.totals.accDisposals).toBeCloseTo(5000, 4);
    expect(report.totals.accClosing).toBeCloseTo(0, 4);
  });

  it('unposting the sale gives the asset back its previous state', async () => {
    await fixedAssetDisposalService.unpost(ctx, disposalId);
    const asset = await prisma.fixedAsset.findFirstOrThrow({ where: { id: assetId } });
    expect(asset.status).toBe('ACTIVE');
    expect(Number(asset.accumulatedDepreciation)).toBeCloseTo(3000, 4);
    expect(asset.depreciatedThrough?.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('keeps companies apart', async () => {
    const other = await prisma.company.create({ data: { arabicName: `FA other ${Date.now()}`, isActive: true } });
    await expect(fixedAssetService.getById(other.id, assetId)).rejects.toMatchObject({ statusCode: 404 });
    await expect(fixedAssetDepreciationService.unpost({ ...ctx, companyId: other.id }, runId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
