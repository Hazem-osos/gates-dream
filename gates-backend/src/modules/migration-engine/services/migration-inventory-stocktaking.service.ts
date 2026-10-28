import type { MigrationContext } from '../migration-context';
import { legacyTableExists } from '../accounting-source-profile';
import { legacyTrim } from '../transforms/legacy-values';
import { resolveHistoricalJournalEntryId } from './migration-journal-link.service';
import { money } from '../accounting/journal-money';

const POSTED = `RTRIM(h.Status)='Post' AND RTRIM(ISNULL(h.Deleted,''))<>'T'`;

export async function importHistoricalStocktaking(ctx: MigrationContext): Promise<{ written: number; skipped: number }> {
  if (!(await legacyTableExists(ctx.source, 'StoreCheckHeader'))) {
    return { written: 0, skipped: 0 };
  }
  const headers = await ctx.source.querySql<Record<string, unknown>>(
    `SELECT h.BranchCode, h.YearID, h.StoreCheckCode, h.Type, h.Date, h.DateH, h.DescA, h.StoreCode, h.GLNum, h.Status, h.Deleted
     FROM dbo.StoreCheckHeader h
     WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED} AND RTRIM(ISNULL(h.Performed,''))='T'`,
    { cc: ctx.legacyCompanyCode }
  );

  let written = 0;
  let skipped = 0;

  for (const h of headers) {
    await ctx.throwIfPaused({ stage: 'INVENTORY', entity: 'StoreCheckHeader' });
    const key = {
      companyCode: ctx.legacyCompanyCode,
      branchCode: legacyTrim(h.BranchCode),
      yearId: legacyTrim(h.YearID),
      storeCheckCode: legacyTrim(h.StoreCheckCode),
    };
    if (await ctx.idMap.findMapping(ctx.migrationJobId, 'StoreCheckHeader', key)) {
      skipped += 1;
      continue;
    }

    const details = await ctx.source.querySql<Record<string, unknown>>(
      `SELECT ItemCode, Qty, ActualQty, Price, UnitCode, ItemAddQty, ItemRemoveQty
       FROM dbo.StoreCheckDetail
       WHERE RTRIM(CompanyCode)=@cc AND RTRIM(BranchCode)=@br AND RTRIM(YearID)=@yr AND RTRIM(StoreCheckCode)=@code`,
      {
        cc: ctx.legacyCompanyCode,
        br: key.branchCode,
        yr: key.yearId,
        code: key.storeCheckCode,
      }
    );

    if (ctx.dryRun) {
      written += 1;
      continue;
    }

    const storeCode = legacyTrim(h.StoreCode);
    const whMap = storeCode
      ? await ctx.idMap.findMapping(ctx.migrationJobId, 'Store', {
          companyCode: ctx.legacyCompanyCode,
          storeCode,
        })
      : null;
    if (!whMap) {
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: 'INVENTORY',
        severity: 'WARNING',
        category: 'STOCKTAKE_WAREHOUSE_UNMAPPED',
        sourceEntity: 'StoreCheckHeader',
        sourceKey: `${key.yearId}|${key.storeCheckCode}`,
        description: `StoreCheck ${key.storeCheckCode} store ${storeCode} not mapped`,
      });
      skipped += 1;
      continue;
    }

    const branchMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', {
      companyCode: ctx.legacyCompanyCode,
      branchCode: key.branchCode,
    });
    const jeId = await resolveHistoricalJournalEntryId(
      ctx,
      key.branchCode,
      key.yearId,
      h.GLNum
    );

    let totalShort = money(0);
    let totalInc = money(0);
    const linePayloads: Array<{
      itemId: string;
      unitId: string | null;
      bookQuantity: string;
      actualQuantity: string;
      unitPrice: string;
      shortageQuantity: string | null;
      increaseQuantity: string | null;
    }> = [];

    for (const d of details) {
      const itemCode = legacyTrim(d.ItemCode);
      const itemMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Item', {
        companyCode: ctx.legacyCompanyCode,
        itemCode,
      });
      if (!itemMap) continue;
      const book = money(d.Qty);
      const actual = money(d.ActualQty ?? d.Qty);
      const price = money(d.Price ?? 0);
      const diff = actual.sub(book);
      let shortage: typeof book | null = null;
      let increase: typeof book | null = null;
      if (diff.lt(0)) {
        shortage = diff.abs();
        totalShort = totalShort.add(shortage.mul(price));
      } else if (diff.gt(0)) {
        increase = diff;
        totalInc = totalInc.add(increase.mul(price));
      }
      linePayloads.push({
        itemId: itemMap.targetId,
        unitId: null,
        bookQuantity: book.toFixed(3),
        actualQuantity: actual.toFixed(3),
        unitPrice: price.toFixed(2),
        shortageQuantity: shortage ? shortage.toFixed(3) : null,
        increaseQuantity: increase ? increase.toFixed(3) : null,
      });
    }

    const st = await ctx.prisma.stocktaking.create({
      data: {
        companyId: ctx.targetCompanyId,
        branchId: branchMap?.targetId ?? null,
        description: legacyTrim(h.DescA) || `Legacy stocktake ${key.storeCheckCode}`,
        serial: key.storeCheckCode,
        date: h.Date instanceof Date ? h.Date : new Date(),
        hijriDate: legacyTrim(h.DateH) || null,
        warehouseId: whMap.targetId,
        totalShortage: totalShort.toFixed(2),
        totalIncrease: totalInc.toFixed(2),
        record: legacyTrim(h.GLNum) || null,
        journalEntryId: jeId,
        isPosted: true,
        postedAt: h.Date instanceof Date ? h.Date : new Date(),
        isApproved: true,
        approvedAt: h.Date instanceof Date ? h.Date : new Date(),
        lines: {
          create: linePayloads.map((lp) => ({
            itemId: lp.itemId,
            warehouseId: whMap.targetId,
            unitId: lp.unitId,
            bookQuantity: lp.bookQuantity,
            actualQuantity: lp.actualQuantity,
            unitPrice: lp.unitPrice,
            shortageQuantity: lp.shortageQuantity,
            increaseQuantity: lp.increaseQuantity,
            shortageTotal: lp.shortageQuantity
              ? money(lp.shortageQuantity).mul(lp.unitPrice).toFixed(2)
              : null,
            increaseTotal: lp.increaseQuantity
              ? money(lp.increaseQuantity).mul(lp.unitPrice).toFixed(2)
              : null,
          })),
        },
      },
    });

    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'StoreCheckHeader',
      sourceKeyParts: key,
      targetModel: 'Stocktaking',
      targetId: st.id,
      outcome: 'CREATED_BY_MIGRATION',
      readOnly: true,
    });
    written += 1;
  }

  return { written, skipped };
}
