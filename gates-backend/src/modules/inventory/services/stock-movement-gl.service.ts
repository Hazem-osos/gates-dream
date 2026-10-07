import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';
import {
  overlayColumnAccountIds,
  type AccountDefs,
} from '../../accounting/settings/account-definition-map';
import { itemCostService } from './item-cost.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import {
  pickInventoryAccount,
  readInventorySystem,
  resolveEffectiveWarehouseGlAccounts,
} from '../utils/inventory-system';

export interface StockGlPostingContext extends JournalPostingContext {
  fiscalYearId: string;
}

function pick(defs: AccountDefs | null, keys: string[]): string | undefined {
  if (!defs) return undefined;
  for (const k of keys) {
    const v = defs[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * Wave 4 fix: was calling `documentSequenceService.nextNumber()`, which
 * opens its *own* nested `prisma.$transaction` on a separate pooled
 * connection — while every caller here already runs inside an outer `tx`
 * that holds `item_quantities` row locks. Under load that's a second
 * connection held per in-flight post (pool pressure) and a real deadlock
 * shape if the nested transaction's `document_sequences` lock and the
 * outer transaction's stock locks end up contended in opposite order across
 * two concurrent posts. `nextNumberInTx` reuses the same `tx`/connection.
 */
async function allocateGlNum(
  tx: Prisma.TransactionClient,
  ctx: StockGlPostingContext
): Promise<string | undefined> {
  // Inventory JEs are system-generated (no user GL number input),
  // so always use automatic sequencing regardless of SerialAutomaticGL setting.
  return documentSequenceService.nextGlNumberInTx(
    tx,
    { companyId: ctx.companyId, branchId: ctx.branchId ?? '', fiscalYearId: ctx.fiscalYearId },
    undefined,
    { forceAutomatic: true }
  );
}

export type ResolveStockGlAccountsOptions = {
  /** تجميع/تفكيك: تحريك قيمة بين حسابات المخزون فقط — لا يُشترط حساب صرف المخزون. */
  transformationOnly?: boolean;
};

export async function resolveStockGlAccounts(
  companyId: string,
  warehouseId?: string | null,
  db: Prisma.TransactionClient | typeof prisma = prisma,
  options?: ResolveStockGlAccountsOptions
) {
  const settings = await db.companySettings.findUnique({
    where: { companyId },
    select: {
      accountDefinitions: true,
      roundingAccountId: true,
      exchangeGainLossAccountId: true,
      retainedEarningsAccountId: true,
      advancedSettings: true,
    },
  });
  const defs = overlayColumnAccountIds((settings?.accountDefinitions ?? {}) as AccountDefs, {
    roundingAccountId: settings?.roundingAccountId,
    exchangeGainLossAccountId: settings?.exchangeGainLossAccountId,
    retainedEarningsAccountId: settings?.retainedEarningsAccountId,
  });
  const system = readInventorySystem(settings?.advancedSettings);

  const inventoryRaw = pick(defs, ['inventoryAccount', 'stockAccount', 'storeAccount']);
  const expenseRaw = pick(defs, [
    'stockIssueExpenseAccount',
    'operatingExpenseAccount',
    'cogsAccount',
    'costOfSalesAccount',
  ]);
  const giftRaw = pick(defs, ['giftsAccount', 'giftAccount']);
  const adjustmentRaw = pick(defs, [
    'stocktakingDeficitAccount',
    'itemLossAccount',
    'inventoryAdjustmentAccount',
    'stockAdjustmentAccount',
    'stockSettlementAccount',
    'stocktakingSurplusAccount',
  ]);

  const transformationOnly = options?.transformationOnly === true;

  if (!inventoryRaw) {
    throw new AppError(422, 'Inventory GL account is not configured in company settings');
  }
  if (!expenseRaw && !transformationOnly) {
    throw new AppError(422, 'Stock issue expense account is not configured in company settings');
  }
  if (!adjustmentRaw) {
    throw new AppError(422, 'Inventory adjustment account is not configured in company settings');
  }

  const inventoryAccountId = await invoiceAccountResolverService.resolveAccountId(
    companyId,
    inventoryRaw,
    db
  );
  const adjustmentAccountId = await invoiceAccountResolverService.resolveAccountId(
    companyId,
    adjustmentRaw,
    db
  );
  const expenseAccountId = expenseRaw
    ? await invoiceAccountResolverService.resolveAccountId(companyId, expenseRaw, db)
    : inventoryAccountId;
  const giftAccountId = giftRaw
    ? await invoiceAccountResolverService.resolveAccountId(companyId, giftRaw, db)
    : undefined;

  let warehouseInventoryId: string | null = null;
  let warehouseCostId: string | null = null;
  let warehouseGiftId: string | null = null;
  if (system === 'PERPETUAL' && warehouseId) {
    const effective = await resolveEffectiveWarehouseGlAccounts(companyId, warehouseId, db);
    warehouseInventoryId = effective.inventoryAccountId;
    warehouseCostId = effective.costAccountId;
    warehouseGiftId = effective.giftAccountId;
  }

  return {
    system,
    companyInventoryAccountId: inventoryAccountId,
    warehouseInventoryAccountId: warehouseInventoryId,
    inventoryAccountId:
      pickInventoryAccount(system, inventoryAccountId, warehouseInventoryId) ?? inventoryAccountId,
    companyExpenseAccountId: expenseAccountId,
    warehouseCostAccountId: warehouseCostId,
    expenseAccountId: pickInventoryAccount(system, expenseAccountId, warehouseCostId) ?? expenseAccountId,
    companyGiftAccountId: giftAccountId,
    warehouseGiftAccountId: warehouseGiftId,
    giftAccountId: pickInventoryAccount(system, giftAccountId, warehouseGiftId) ?? giftAccountId,
    adjustmentAccountId,
    assemblyExtraCostAccountId: pick(defs, ['assemblyExtraCostAccount'])
      ? await invoiceAccountResolverService.resolveAccountId(companyId, pick(defs, ['assemblyExtraCostAccount'])!, db)
      : adjustmentAccountId,
  };
}

export function pickLineInventoryAccount(
  accounts: Awaited<ReturnType<typeof resolveStockGlAccounts>>,
  itemAccountId?: string | null
) {
  return (
    pickInventoryAccount(
      accounts.system,
      accounts.companyInventoryAccountId,
      accounts.warehouseInventoryAccountId,
      itemAccountId
    ) ?? accounts.inventoryAccountId
  );
}

/** Goods issue: perpetual inventory credit uses warehouse card (then company), not item main account. */
export function pickGoodsIssueInventoryAccount(
  accounts: Awaited<ReturnType<typeof resolveStockGlAccounts>>
) {
  if (accounts.system === 'PERPETUAL') {
    return (
      accounts.warehouseInventoryAccountId ||
      accounts.companyInventoryAccountId ||
      accounts.inventoryAccountId
    );
  }
  return accounts.inventoryAccountId;
}

export function pickGoodsIssueExpenseAccount(
  accounts: Awaited<ReturnType<typeof resolveStockGlAccounts>>,
  overrideExpenseAccountId?: string
) {
  if (overrideExpenseAccountId) return overrideExpenseAccountId;
  if (accounts.system === 'PERPETUAL' && accounts.warehouseCostAccountId) {
    return accounts.warehouseCostAccountId;
  }
  return accounts.expenseAccountId;
}

type IssueWithLines = Prisma.IssueGetPayload<{ include: { lines: true } }>;
type ReceiptWithLines = Prisma.ReceiptGetPayload<{ include: { lines: true } }>;
type StocktakingDoc = Prisma.StocktakingGetPayload<{ include: { lines: true } }>;
type AdjustmentDoc = Prisma.AdjustmentGetPayload<{ include: { lines: true } }>;
type TransferDoc = Prisma.TransferGetPayload<{ include: { lines: true } }>;

function sourceYearOf(date: Date): string {
  return String(new Date(date).getFullYear());
}

function journalLink(je: { id: string; legacyGlNum?: string | null }) {
  return {
    record: je.legacyGlNum ?? je.id,
    journalEntryId: je.id,
  };
}

function addAmount(map: Map<string, number>, accountId: string | undefined, amount: number) {
  if (!accountId || amount <= 0) return;
  map.set(accountId, roundTo4((map.get(accountId) ?? 0) + amount));
}

function linesFromAmountMap(
  amounts: Map<string, number>,
  side: 'debit' | 'credit',
  description: string,
  startOrder: number,
  costCenterId?: string | null
): JournalEntryLineData[] {
  let lineOrder = startOrder;
  return [...amounts.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([accountId, amount]) => ({
      accountId,
      debit: side === 'debit' ? amount : 0,
      credit: side === 'credit' ? amount : 0,
      lineOrder: lineOrder++,
      description,
      costCenterId: costCenterId ?? undefined,
    }));
}

type TransformationGlSideLine = { accountId: string; amount: number; description: string };

/** Gross debit/credit lines per account — never net to zero on a single inventory account. */
export function buildInventoryTransformationJournalLines(
  debitLines: TransformationGlSideLine[],
  creditLines: TransformationGlSideLine[]
): JournalEntryLineData[] {
  const debitByAccount = new Map<string, { amount: number; description: string }>();
  const creditByAccount = new Map<string, { amount: number; description: string }>();

  for (const l of debitLines) {
    if (!l.accountId || l.amount <= 0) continue;
    const cur = debitByAccount.get(l.accountId) ?? { amount: 0, description: l.description };
    cur.amount = roundTo4(cur.amount + l.amount);
    debitByAccount.set(l.accountId, cur);
  }
  for (const l of creditLines) {
    if (!l.accountId || l.amount <= 0) continue;
    const cur = creditByAccount.get(l.accountId) ?? { amount: 0, description: l.description };
    cur.amount = roundTo4(cur.amount + l.amount);
    creditByAccount.set(l.accountId, cur);
  }

  let lineOrder = 1;
  const lines: JournalEntryLineData[] = [];
  for (const [accountId, v] of debitByAccount.entries()) {
    if (v.amount <= 0) continue;
    lines.push({
      accountId,
      debit: v.amount,
      credit: 0,
      lineOrder: lineOrder++,
      description: v.description,
    });
  }
  for (const [accountId, v] of creditByAccount.entries()) {
    if (v.amount <= 0) continue;
    lines.push({
      accountId,
      debit: 0,
      credit: v.amount,
      lineOrder: lineOrder++,
      description: v.description,
    });
  }
  return lines;
}

async function loadItemInventoryMap(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemIds: string[]
): Promise<Map<string, { mainAccountId: string | null; averageCost: unknown }>> {
  if (itemIds.length === 0) return new Map();
  // Scope by companyId so cross-tenant item IDs can never return a wrong account
  const rows = await tx.item.findMany({
    where: { id: { in: itemIds }, companyId },
    select: { id: true, mainAccountId: true, averageCost: true },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

export class StockMovementGlService {
  async postGoodsIssueGlInTx(
    tx: Prisma.TransactionClient,
    ctx: StockGlPostingContext,
    issue: IssueWithLines,
    options?: { expenseAccountId?: string; costCenterId?: string | null }
  ) {
    const txSettings = await tx.transactionSettings.findUnique({
      where: {
        companyId_documentType: { companyId: ctx.companyId, documentType: 'STOCK_ISSUE' },
      },
      select: { generateEntryOnSave: true, defaultCostCenterId: true },
    });
    if (txSettings?.generateEntryOnSave === false) return null;

    const accounts = await resolveStockGlAccounts(ctx.companyId, issue.warehouseId, tx);
    const expenseAccountId = pickGoodsIssueExpenseAccount(accounts, options?.expenseAccountId);
    const costCenterId = options?.costCenterId ?? txSettings?.defaultCostCenterId ?? undefined;

    if (accounts.system === 'PERPETUAL') {
      if (!accounts.warehouseCostAccountId) {
        throw new AppError(
          422,
          'عرّف حساب تكلفة البضاعة المباعة في بطاقة المخزن (أو المخزن الأب) ثم أعد الترحيل'
        );
      }
      if (!accounts.warehouseInventoryAccountId) {
        throw new AppError(422, 'عرّف حساب المخزون في بطاقة المخزن (أو المخزن الأب) ثم أعد الترحيل');
      }
    }

    const issueInventoryAccountId = pickGoodsIssueInventoryAccount(accounts);

    const itemIds = [...new Set(issue.lines.map((l) => l.itemId))];
    const unitCosts = await itemCostService.getCostsAsOf(ctx.companyId, itemIds, issue.date, tx);

    const issueByInv = new Map<string, number>();
    const giftByInv = new Map<string, number>();
    let issueCost = 0;
    let giftCost = 0;
    for (const line of issue.lines) {
      const qty = Number(line.quantity);
      const specified = line.unitPrice != null ? Number(line.unitPrice) : null;
      const isGift = specified === 0;
      const unit = unitCosts.get(line.itemId) ?? 0;
      const value = roundTo4(qty * unit);
      if (value <= 0) continue;
      const invAccount = issueInventoryAccountId;
      if (isGift) {
        giftCost += value;
        addAmount(giftByInv, invAccount, value);
      } else {
        issueCost += value;
        addAmount(issueByInv, invAccount, value);
      }
    }
    issueCost = roundTo4(issueCost);
    giftCost = roundTo4(giftCost);
    if (issueCost <= 0 && giftCost <= 0) return null;

    const giftAccountId = accounts.giftAccountId || accounts.companyGiftAccountId || expenseAccountId;
    const legacyGlNum = await allocateGlNum(tx, ctx);
    const serial = issue.serial ?? issue.id.slice(0, 8);
    const sourceYearId = String(new Date(issue.date).getFullYear());

    const lines: JournalEntryLineData[] = [];
    if (issueCost > 0) {
      lines.push({
        accountId: expenseAccountId,
        debit: issueCost,
        credit: 0,
        lineOrder: lines.length + 1,
        description: 'Goods issue — COGS',
        costCenterId: costCenterId ?? undefined,
      });
      lines.push(
        ...linesFromAmountMap(
          issueByInv,
          'credit',
          'Goods issue — inventory relief',
          lines.length + 1,
          costCenterId
        )
      );
    }
    if (giftCost > 0) {
      lines.push({
        accountId: giftAccountId,
        debit: giftCost,
        credit: 0,
        lineOrder: lines.length + 1,
        description: 'Goods issue — gift',
        costCenterId: costCenterId ?? undefined,
      });
      lines.push(
        ...linesFromAmountMap(
          giftByInv,
          'credit',
          'Goods issue — gift inventory relief',
          lines.length + 1,
          costCenterId
        )
      );
    }
    lines.forEach((line, index) => {
      line.lineOrder = index + 1;
    });

    const je = await journalPostingService.createAndPostInTx(tx, ctx, {
      date: issue.date,
      hijriDate: issue.hijriDate ?? undefined,
      description: issue.description ?? `Goods issue ${serial}`,
      currencyCode: 'EGP',
      fiscalYearId: ctx.fiscalYearId,
      legacyGlNum,
      sourceType: 'GI',
      sourceNumber: serial,
      sourceYearId,
      sourceId: issue.id,
      entryType: 'GOODS_ISSUE',
      lines,
    });

    await tx.issue.update({
      where: { id: issue.id },
      data: journalLink(je),
    });

    return je;
  }

  async resolveGoodsReceiptCreditAccountInTx(
    tx: Prisma.TransactionClient,
    ctx: StockGlPostingContext,
    fallbackAdjustmentAccountId: string
  ): Promise<string> {
    const settings = await tx.transactionSettings.findUnique({
      where: {
        companyId_documentType: { companyId: ctx.companyId, documentType: 'STOCK_RECEIPT' },
      },
      select: { defaultOffsetAccountId: true },
    });
    const offsetId = settings?.defaultOffsetAccountId?.trim();
    if (!offsetId) return fallbackAdjustmentAccountId;

    const account = await tx.account.findFirst({
      where: { id: offsetId, companyId: ctx.companyId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!account) {
      throw new AppError(
        422,
        'الحساب المقابل لإذن الإضافة في إعدادات المستند غير موجود أو غير نشط'
      );
    }
    return account.id;
  }

  async postGoodsReceiptGlInTx(
    tx: Prisma.TransactionClient,
    ctx: StockGlPostingContext,
    receipt: ReceiptWithLines,
    options?: { costCenterId?: string | null }
  ) {
    const txSettings = await tx.transactionSettings.findUnique({
      where: {
        companyId_documentType: { companyId: ctx.companyId, documentType: 'STOCK_RECEIPT' },
      },
      select: { generateEntryOnSave: true, defaultCostCenterId: true },
    });
    if (txSettings?.generateEntryOnSave === false) return null;

    const accounts = await resolveStockGlAccounts(ctx.companyId, receipt.warehouseId);
    const creditAccountId = await this.resolveGoodsReceiptCreditAccountInTx(
      tx,
      ctx,
      accounts.adjustmentAccountId
    );
    const costCenterId = options?.costCenterId ?? txSettings?.defaultCostCenterId ?? undefined;

    const itemIds = [...new Set(receipt.lines.map((l) => l.itemId))];
    const items = await loadItemInventoryMap(tx, ctx.companyId, itemIds);

    const inventoryByAccount = new Map<string, number>();
    let totalCost = 0;
    for (const line of receipt.lines) {
      const qty = Number(line.quantity);
      const specified = line.unitPrice != null ? Number(line.unitPrice) : 0;
      const unit = specified > 0 ? specified : Number(items.get(line.itemId)?.averageCost ?? 0);
      const value = roundTo4(qty * unit);
      if (value <= 0) continue;
      totalCost += value;
      addAmount(
        inventoryByAccount,
        pickLineInventoryAccount(accounts, items.get(line.itemId)?.mainAccountId),
        value
      );
    }
    totalCost = roundTo4(totalCost);
    if (totalCost <= 0) return null;

    const legacyGlNum = await allocateGlNum(tx, ctx);
    const serial = receipt.serial ?? receipt.id.slice(0, 8);
    const sourceYearId = String(new Date(receipt.date).getFullYear());

    const lines: JournalEntryLineData[] = [
      ...linesFromAmountMap(
        inventoryByAccount,
        'debit',
        'Goods receipt — inventory',
        1,
        costCenterId
      ),
      {
        accountId: creditAccountId,
        debit: 0,
        credit: totalCost,
        lineOrder: inventoryByAccount.size + 1,
        description: 'Goods receipt — offset',
        costCenterId: costCenterId ?? undefined,
      },
    ];
    lines.forEach((line, index) => {
      line.lineOrder = index + 1;
    });

    const je = await journalPostingService.createAndPostInTx(tx, ctx, {
      date: receipt.date,
      hijriDate: receipt.hijriDate ?? undefined,
      description: receipt.description ?? `Goods receipt ${serial}`,
      currencyCode: 'EGP',
      fiscalYearId: ctx.fiscalYearId,
      legacyGlNum,
      sourceType: 'GR',
      sourceNumber: serial,
      sourceYearId,
      sourceId: receipt.id,
      entryType: 'GOODS_RECEIPT',
      lines,
    });

    await tx.receipt.update({
      where: { id: receipt.id },
      data: journalLink(je),
    });

    return je;
  }

  /**
   * C3 fix — a physical count variance is a real economic event: shortage
   * is shrinkage expense, surplus is a gain. Both must move the GL
   * inventory control account so it can ever reconcile to the stock ledger.
   */
  async postStocktakingVarianceGlInTx(
    tx: Prisma.TransactionClient,
    ctx: StockGlPostingContext,
    stocktaking: StocktakingDoc,
    options?: { costCenterId?: string | null }
  ) {
    // P1 fix: this used to trust `stocktaking.totalShortage`/`totalIncrease`,
    // which are computed once at create time from whatever `unitPrice` the
    // caller supplied per line (schema requires the column but nothing
    // stops a caller sending `0`). A count variance saved with no price
    // still moves real stock quantity via `postMovementInTx`, so a zero
    // price here posts a zero-value JE and the Inventory control account
    // silently stops tying to valuation. Recompute from the lines at post
    // time instead, falling back to the moving-average cost for any line
    // whose price is missing or zero.
    const zeroOrMissingPriceItemIds = stocktaking.lines
      .filter((l) => !l.unitPrice || Number(l.unitPrice) === 0)
      .map((l) => l.itemId);
    const fallbackCosts =
      zeroOrMissingPriceItemIds.length > 0
        ? await itemCostService.getCostsAsOf(ctx.companyId, zeroOrMissingPriceItemIds, stocktaking.date, tx)
        : new Map<string, number>();

    const accounts = await resolveStockGlAccounts(ctx.companyId, stocktaking.warehouseId);
    const items = await loadItemInventoryMap(
      tx,
      ctx.companyId,
      [...new Set(stocktaking.lines.map((l) => l.itemId))]
    );

    const shortageByInv = new Map<string, number>();
    const increaseByInv = new Map<string, number>();
    let shortage = 0;
    let increase = 0;
    for (const line of stocktaking.lines) {
      const priceRaw = Number(line.unitPrice);
      const price = priceRaw > 0 ? priceRaw : fallbackCosts.get(line.itemId) ?? 0;
      const shortageQty = Number(line.shortageQuantity ?? 0);
      const increaseQty = Number(line.increaseQuantity ?? 0);
      const invAccount = pickLineInventoryAccount(accounts, items.get(line.itemId)?.mainAccountId);
      if (shortageQty > 0) {
        const value = roundTo4(shortageQty * price);
        shortage += value;
        addAmount(shortageByInv, invAccount, value);
      }
      if (increaseQty > 0) {
        const value = roundTo4(increaseQty * price);
        increase += value;
        addAmount(increaseByInv, invAccount, value);
      }
    }
    shortage = roundTo4(shortage);
    increase = roundTo4(increase);
    if (shortage <= 0 && increase <= 0) return null;

    const legacyGlNum = await allocateGlNum(tx, ctx);
    const serial = stocktaking.serial ?? stocktaking.id.slice(0, 8);
    const sourceYearId = sourceYearOf(stocktaking.date);

    const lines: JournalEntryLineData[] = [];
    if (shortage > 0) {
      lines.push({
        accountId: accounts.adjustmentAccountId,
        debit: shortage,
        credit: 0,
        lineOrder: 1,
        description: 'Stocktaking shortage — shrinkage',
        costCenterId: options?.costCenterId ?? undefined,
      });
      lines.push(
        ...linesFromAmountMap(
          shortageByInv,
          'credit',
          'Stocktaking shortage — inventory relief',
          lines.length + 1,
          options?.costCenterId
        )
      );
    }
    if (increase > 0) {
      lines.push(
        ...linesFromAmountMap(
          increaseByInv,
          'debit',
          'Stocktaking surplus — inventory gain',
          lines.length + 1,
          options?.costCenterId
        )
      );
      lines.push({
        accountId: accounts.adjustmentAccountId,
        debit: 0,
        credit: increase,
        lineOrder: lines.length + 1,
        description: 'Stocktaking surplus — offset',
        costCenterId: options?.costCenterId ?? undefined,
      });
    }
    lines.forEach((line, index) => {
      line.lineOrder = index + 1;
    });

    const je = await journalPostingService.createAndPostInTx(tx, ctx, {
      date: stocktaking.date,
      hijriDate: stocktaking.hijriDate ?? undefined,
      description: stocktaking.description ?? `Stocktaking ${serial}`,
      currencyCode: 'EGP',
      fiscalYearId: ctx.fiscalYearId,
      legacyGlNum,
      sourceType: 'STK',
      sourceNumber: serial,
      sourceYearId,
      entryType: 'STOCKTAKING',
      lines,
    });

    await tx.stocktaking.update({
      where: { id: stocktaking.id },
      data: journalLink(je),
    });

    return je;
  }

  /**
   * C3 fix — manual quantity adjustments are also real economic events.
   * Net increase across lines debits inventory / credits the adjustment
   * (shrinkage) account; net decrease is the mirror entry.
   */
  async postAdjustmentVarianceGlInTx(
    tx: Prisma.TransactionClient,
    ctx: StockGlPostingContext,
    adjustment: AdjustmentDoc,
    options?: { costCenterId?: string | null }
  ) {
    // Surplus (increase) uses the adjustment valuation cost, falling back
    // to MAC when the caller left unitPrice empty. Shortage always consumes
    // current MAC — the same figure applyOutboundMovement posts to stock —
    // so the variance JE ties to inventory relief.
    const macItemIds = [
      ...new Set(
        adjustment.lines
          .filter((l) => {
            const qty = Number(l.adjustmentQuantity);
            const specified = l.unitPrice != null ? Number(l.unitPrice) : 0;
            return qty < 0 || specified <= 0;
          })
          .map((l) => l.itemId)
      ),
    ];
    const macCosts =
      macItemIds.length > 0
        ? await itemCostService.getCostsAsOf(ctx.companyId, macItemIds, adjustment.date, tx)
        : new Map<string, number>();

    const accounts = await resolveStockGlAccounts(ctx.companyId, adjustment.warehouseId);
    const items = await loadItemInventoryMap(
      tx,
      ctx.companyId,
      [...new Set(adjustment.lines.map((l) => l.itemId))]
    );

    const increaseByInv = new Map<string, number>();
    const decreaseByInv = new Map<string, number>();
    let netIncrease = 0;
    let netDecrease = 0;
    for (const line of adjustment.lines) {
      const qty = Number(line.adjustmentQuantity);
      const specified = line.unitPrice != null ? Number(line.unitPrice) : 0;
      const unit =
        qty < 0
          ? macCosts.get(line.itemId) ?? 0
          : specified > 0
            ? specified
            : macCosts.get(line.itemId) ?? 0;
      const value = roundTo4(qty * unit);
      const invAccount = pickLineInventoryAccount(accounts, items.get(line.itemId)?.mainAccountId);
      if (value > 0) {
        netIncrease += value;
        addAmount(increaseByInv, invAccount, value);
      } else if (value < 0) {
        netDecrease += Math.abs(value);
        addAmount(decreaseByInv, invAccount, Math.abs(value));
      }
    }
    netIncrease = roundTo4(netIncrease);
    netDecrease = roundTo4(netDecrease);
    if (netIncrease <= 0 && netDecrease <= 0) return null;
    const legacyGlNum = await allocateGlNum(tx, ctx);
    const serial = adjustment.serial ?? adjustment.id.slice(0, 8);
    const sourceYearId = sourceYearOf(adjustment.date);

    const lines: JournalEntryLineData[] = [];
    if (netDecrease > 0) {
      lines.push({
        accountId: accounts.adjustmentAccountId,
        debit: netDecrease,
        credit: 0,
        lineOrder: 1,
        description: 'Adjustment decrease — shrinkage',
        costCenterId: options?.costCenterId ?? undefined,
      });
      lines.push(
        ...linesFromAmountMap(
          decreaseByInv,
          'credit',
          'Adjustment decrease — inventory relief',
          lines.length + 1,
          options?.costCenterId
        )
      );
    }
    if (netIncrease > 0) {
      lines.push(
        ...linesFromAmountMap(
          increaseByInv,
          'debit',
          'Adjustment increase — inventory gain',
          lines.length + 1,
          options?.costCenterId
        )
      );
      lines.push({
        accountId: accounts.adjustmentAccountId,
        debit: 0,
        credit: netIncrease,
        lineOrder: lines.length + 1,
        description: 'Adjustment increase — offset',
        costCenterId: options?.costCenterId ?? undefined,
      });
    }
    lines.forEach((line, index) => {
      line.lineOrder = index + 1;
    });

    const je = await journalPostingService.createAndPostInTx(tx, ctx, {
      date: adjustment.date,
      hijriDate: adjustment.hijriDate ?? undefined,
      description: adjustment.description ?? `Adjustment ${serial}`,
      currencyCode: 'EGP',
      fiscalYearId: ctx.fiscalYearId,
      legacyGlNum,
      sourceType: 'ADJ',
      sourceNumber: serial,
      sourceYearId,
      entryType: 'ADJUSTMENT',
      lines,
    });

    await tx.adjustment.update({
      where: { id: adjustment.id },
      data: journalLink(je),
    });

    return je;
  }

  async postOtherAdjustmentGlInTx(
    tx: Prisma.TransactionClient,
    ctx: StockGlPostingContext,
    adjustment: Prisma.OtherAdjustmentGetPayload<{ include: { lines: true } }>
  ) {
    const accounts = await resolveStockGlAccounts(ctx.companyId, adjustment.warehouseId);
    const items = await loadItemInventoryMap(
      tx,
      ctx.companyId,
      [...new Set(adjustment.lines.map((l) => l.itemId))]
    );

    const increaseByInv = new Map<string, number>();
    const decreaseByInv = new Map<string, number>();
    let netIncrease = 0;
    let netDecrease = 0;
    for (const line of adjustment.lines) {
      const qty = Number(line.quantity);
      if (qty <= 0) continue;
      const unit = line.unitPrice != null ? Number(line.unitPrice) : 0;
      const value = roundTo4(qty * unit);
      if (value <= 0) continue;
      const invAccount = pickLineInventoryAccount(accounts, items.get(line.itemId)?.mainAccountId);
      if (line.adjustmentType === 'discount') {
        netDecrease += value;
        addAmount(decreaseByInv, invAccount, value);
      } else {
        netIncrease += value;
        addAmount(increaseByInv, invAccount, value);
      }
    }
    netIncrease = roundTo4(netIncrease);
    netDecrease = roundTo4(netDecrease);
    if (netIncrease <= 0 && netDecrease <= 0) return null;

    const legacyGlNum = await allocateGlNum(tx, ctx);
    const serial = adjustment.serial ?? adjustment.id.slice(0, 8);
    const sourceYearId = sourceYearOf(adjustment.date);

    const lines: JournalEntryLineData[] = [];
    if (netDecrease > 0) {
      lines.push({
        accountId: accounts.adjustmentAccountId,
        debit: netDecrease,
        credit: 0,
        lineOrder: 1,
        description: 'Other adjustment decrease — shrinkage',
        costCenterId: undefined,
      });
      lines.push(
        ...linesFromAmountMap(
          decreaseByInv,
          'credit',
          'Other adjustment decrease — inventory relief',
          lines.length + 1
        )
      );
    }
    if (netIncrease > 0) {
      lines.push(
        ...linesFromAmountMap(
          increaseByInv,
          'debit',
          'Other adjustment increase — inventory gain',
          lines.length + 1
        )
      );
      lines.push({
        accountId: accounts.adjustmentAccountId,
        debit: 0,
        credit: netIncrease,
        lineOrder: lines.length + 1,
        description: 'Other adjustment increase — offset',
        costCenterId: undefined,
      });
    }
    lines.forEach((line, index) => {
      line.lineOrder = index + 1;
    });

    return journalPostingService.createAndPostInTx(tx, ctx, {
      date: adjustment.date,
      hijriDate: adjustment.hijriDate ?? undefined,
      description: adjustment.description ?? `Other adjustment ${serial}`,
      currencyCode: 'EGP',
      fiscalYearId: ctx.fiscalYearId,
      legacyGlNum,
      sourceType: 'OADJ',
      sourceNumber: serial,
      sourceYearId,
      entryType: 'ADJUSTMENT',
      lines,
    });
  }

  /**
   * Assembly/disassembly move value between the raw-material and finished
   * item inventory accounts (a production receipt / issue). When both sides
   * map to the same company inventory account the entry is self-balancing on
   * the account balance but still posts separate debit/credit lines for an
   * audit trail; when items carry distinct `mainAccountId`s the value moves
   * between control accounts.
   */
  async postInventoryTransformationGlInTx(
    tx: Prisma.TransactionClient,
    ctx: StockGlPostingContext,
    doc: { id: string; date: Date; hijriDate?: string | null; description?: string | null; serial?: string | null },
    kind: 'ASSEMBLY' | 'DISASSEMBLY',
    debitLines: { accountId: string; amount: number; description: string }[],
    creditLines: { accountId: string; amount: number; description: string }[],
    _model: 'assembly' | 'disassembly'
  ) {
    const totalDebit = roundTo4(debitLines.reduce((s, l) => s + l.amount, 0));
    const totalCredit = roundTo4(creditLines.reduce((s, l) => s + l.amount, 0));
    if (totalDebit <= 0 || totalCredit <= 0) return null;
    if (Math.abs(totalDebit - totalCredit) > 0.02) {
      throw new AppError(
        422,
        `قيد ${kind === 'ASSEMBLY' ? 'التجميع' : 'التفكيك'} غير متوازن (مدين ${totalDebit} — دائن ${totalCredit})`
      );
    }

    const lines = buildInventoryTransformationJournalLines(debitLines, creditLines);
    if (lines.length === 0) return null;

    const legacyGlNum = await allocateGlNum(tx, ctx);
    const serial = doc.serial ?? doc.id.slice(0, 8);
    const sourceYearId = sourceYearOf(doc.date);
    const sourceType = kind === 'ASSEMBLY' ? 'ASM' : 'DSM';

    const je = await journalPostingService.createAndPostInTx(tx, ctx, {
      date: doc.date,
      hijriDate: doc.hijriDate ?? undefined,
      description: doc.description ?? `${kind === 'ASSEMBLY' ? 'Assembly' : 'Disassembly'} ${serial}`,
      currencyCode: 'EGP',
      fiscalYearId: ctx.fiscalYearId,
      legacyGlNum,
      sourceType,
      sourceNumber: serial,
      sourceYearId,
      entryType: kind,
      lines,
    });

    return je;
  }

  /**
   * Wave 3 fix — `transfer.service.ts#postTransfer` was calling
   * `tx.costCenterMovement.create()` with fields that don't exist on the
   * model (`fromCostCenterId`/`toCostCenterId`/`amount` vs the real
   * `costCenterId`/`accountId`/`debit`/`credit`), which throws a Prisma
   * validation error at runtime on every transfer between differing cost
   * centers, and `unpostTransfer` never reversed it at all. This posts a
   * real, reversible journal entry moving value from the source to the
   * destination cost center (same pattern as assembly/disassembly: each
   * item's own `mainAccountId` is used when set, so items whose GL profile
   * maps to a different control account than the company default genuinely
   * move value between accounts; otherwise the entry is self-balancing per
   * account but still carries distinct cost centers per line), and mirrors
   * the posted lines into `CostCenterMovement` for cost-center reporting.
   */
  async postTransferValueGlInTx(
    tx: Prisma.TransactionClient,
    ctx: StockGlPostingContext,
    transfer: TransferDoc
  ) {
    if (!ctx.fiscalYearId?.trim()) return null;

    const itemIds = [...new Set(transfer.lines.map((l) => l.itemId))];
    const [items, unitCosts] = await Promise.all([
      tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, mainAccountId: true } }),
      itemCostService.getCostsAsOf(ctx.companyId, itemIds, transfer.date, tx),
    ]);
    const itemAccountById = new Map(items.map((i) => [i.id, i.mainAccountId]));
    const [fromAccounts, toAccounts] = await Promise.all([
      resolveStockGlAccounts(ctx.companyId, transfer.fromWarehouseId, tx),
      resolveStockGlAccounts(ctx.companyId, transfer.toWarehouseId, tx),
    ]);
    let total = 0;
    const debitLines: { accountId: string; amount: number; description: string }[] = [];
    const creditLines: { accountId: string; amount: number; description: string }[] = [];
    for (const line of transfer.lines) {
      const qty = Number(line.quantity);
      if (qty <= 0) continue;
      const unit =
        line.unitPrice != null ? Number(line.unitPrice) : unitCosts.get(line.itemId) ?? 0;
      const value = roundTo4(qty * unit);
      if (value <= 0) continue;
      const fromAccountId = pickLineInventoryAccount(fromAccounts, itemAccountById.get(line.itemId));
      const toAccountId = pickLineInventoryAccount(toAccounts, itemAccountById.get(line.itemId));
      if (!fromAccountId || !toAccountId) return null;
      total += value;
      debitLines.push({
        accountId: toAccountId,
        amount: value,
        description: 'Transfer — inventory into destination warehouse',
      });
      creditLines.push({
        accountId: fromAccountId,
        amount: value,
        description: 'Transfer — inventory out of source warehouse',
      });
    }
    if (total <= 0) return null;

    const legacyGlNum = await allocateGlNum(tx, ctx);
    const serial = transfer.serial ?? transfer.id.slice(0, 8);
    const sourceYearId = sourceYearOf(transfer.date);

    const lines: JournalEntryLineData[] = [];
    let lineOrder = 1;
    for (const l of debitLines) {
      lines.push({
        accountId: l.accountId,
        debit: roundTo4(l.amount),
        credit: 0,
        lineOrder: lineOrder++,
        description: l.description,
        costCenterId: transfer.toCostCenterId,
      });
    }
    for (const l of creditLines) {
      lines.push({
        accountId: l.accountId,
        debit: 0,
        credit: roundTo4(l.amount),
        lineOrder: lineOrder++,
        description: l.description,
        costCenterId: transfer.fromCostCenterId,
      });
    }

    const je = await journalPostingService.createAndPostInTx(tx, ctx, {
      date: transfer.date,
      hijriDate: transfer.hijriDate ?? undefined,
      description: transfer.description ?? `نقل مخزني ${serial}`,
      currencyCode: 'EGP',
      fiscalYearId: ctx.fiscalYearId,
      legacyGlNum,
      sourceType: 'TRF',
      sourceNumber: serial,
      sourceYearId,
      entryType: 'TRANSFER',
      lines,
    });

    const ccRows = lines.filter((l) => l.accountId && l.costCenterId);
    if (ccRows.length) {
      await tx.costCenterMovement.createMany({
        data: ccRows.map((l) => ({
          companyId: ctx.companyId,
          accountId: l.accountId,
          costCenterId: l.costCenterId!,
          date: transfer.date,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
        })),
      });
    }

    await tx.transfer.update({
      where: { id: transfer.id },
      data: journalLink(je),
    });

    return je;
  }

  /** Unpost the active journal for a stock voucher on the same row. */
  async reverseBySourceInTx(
    tx: Prisma.TransactionClient,
    ctx: StockGlPostingContext,
    sourceType: string,
    sourceNumber: string,
    sourceYearId: string,
    reason: string,
    sourceDocumentId?: string | null
  ) {
    const keys = [
      journalPostingService.buildActiveSourceKey(
        ctx.companyId,
        sourceType,
        sourceNumber,
        sourceYearId,
        sourceDocumentId
      ),
      journalPostingService.buildActiveSourceKey(
        ctx.companyId,
        sourceType,
        sourceNumber,
        sourceYearId
      ),
    ].filter((key): key is string => Boolean(key));
    if (keys.length === 0) return null;
    let je = null;
    for (const key of keys) {
      je = await tx.journalEntry.findUnique({ where: { activeSourceKey: key } });
      if (je) break;
    }
    if (!je) return null;
    const reversed = await journalPostingService.reverseJournalEntryInTx(tx, ctx, je.id, { reason });
    await journalPostingService.cascadeSourceJournalInTx(
      tx,
      ctx.companyId,
      [je.id],
      'unpost',
      ctx.userId
    );
    return reversed;
  }
}

export const stockMovementGlService = new StockMovementGlService();
