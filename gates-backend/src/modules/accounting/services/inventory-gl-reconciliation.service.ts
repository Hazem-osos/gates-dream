import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { itemCostService } from '../../inventory/services/item-cost.service';
import { resolveStockGlAccounts } from '../../inventory/services/stock-movement-gl.service';

const EPS = 0.01;

export interface InventoryGlReconciliationParams {
  companyId: string;
  /** Only include this warehouse's on-hand quantity (GL still compared company-wide — the GL control account has no warehouse dimension). */
  warehouseId?: string;
}

export interface InventoryGlAccountBreakdown {
  accountId: string;
  accountCode: string;
  accountName: string;
  glBalance: number;
  stockLedgerValue: number;
  variance: number;
  isReconciled: boolean;
  itemCount: number;
}

export interface InventoryGlItemVariance {
  itemId: string;
  itemCode: string | null;
  itemName: string;
  accountId: string;
  quantityOnHand: number;
  unitCost: number;
  value: number;
  hasNegativeStock: boolean;
  hasMissingCost: boolean;
}

export interface InventoryGlReconciliationResult {
  companyId: string;
  generatedAt: string;
  glInventoryBalance: number;
  stockLedgerValue: number;
  variance: number;
  isReconciled: boolean;
  accountBreakdown: InventoryGlAccountBreakdown[];
  /** Items whose value materially drives any variance, or that carry a data-integrity flag (negative stock / missing cost) — always worth a look even if the account they roll up into happens to reconcile. */
  flaggedItems: InventoryGlItemVariance[];
}

/**
 * H1/C3/Phase-2-item-16 — a *permanent* control that answers "does the GL
 * inventory control account actually match what the stock ledger says is on
 * hand?" on demand, instead of only as a one-off Phase 0 diagnostic script.
 *
 * Each item can sit on its own control account (see `Item.mainAccountId`,
 * used consistently by assembly/disassembly/landed-cost GL postings), so the
 * comparison is done per resolved account, not as one global number — a
 * company with a "raw materials" and a "finished goods" inventory account
 * should see each reconcile independently.
 */
export class InventoryGlReconciliationService {
  private async accountBalance(companyId: string, accountId: string): Promise<number> {
    const agg = await prisma.journalEntryLine.aggregate({
      where: {
        accountId,
        journalEntry: { companyId, isPosted: true, isCancelled: false, deletedAt: null },
      },
      _sum: { debitBase: true, creditBase: true },
    });
    return roundTo4(Number(agg._sum.debitBase ?? 0) - Number(agg._sum.creditBase ?? 0));
  }

  async getReconciliation(
    params: InventoryGlReconciliationParams
  ): Promise<InventoryGlReconciliationResult> {
    const { companyId, warehouseId } = params;

    const defaultAccounts = await resolveStockGlAccounts(companyId).catch(() => null);
    const defaultInventoryAccountId = defaultAccounts?.inventoryAccountId;

    const items = await prisma.item.findMany({
      where: { companyId },
      select: { id: true, serial: true, arabicName: true, englishName: true, mainAccountId: true },
    });

    const quantities = await prisma.itemQuantity.findMany({
      where: {
        item: { companyId },
        ...(warehouseId ? { warehouseId } : {}),
      },
      select: { itemId: true, quantity: true },
    });
    const qtyByItem = new Map<string, number>();
    for (const q of quantities) {
      qtyByItem.set(q.itemId, roundTo4((qtyByItem.get(q.itemId) ?? 0) + Number(q.quantity)));
    }

    const itemIds = items.map((i) => i.id);
    const costByItem = await itemCostService.getCostsAsOf(companyId, itemIds, new Date());

    const accountRows = new Map<
      string,
      { itemCount: number; stockValue: number }
    >();
    const flaggedItems: InventoryGlItemVariance[] = [];

    for (const item of items) {
      const accountId = item.mainAccountId ?? defaultInventoryAccountId;
      if (!accountId) continue; // no control account resolvable for this item — nothing to reconcile against

      const quantityOnHand = qtyByItem.get(item.id) ?? 0;
      const unitCost = costByItem.get(item.id) ?? 0;
      const value = roundTo4(quantityOnHand * unitCost);
      const hasNegativeStock = quantityOnHand < 0;
      const hasMissingCost = quantityOnHand !== 0 && unitCost === 0;

      const bucket = accountRows.get(accountId) ?? { itemCount: 0, stockValue: 0 };
      bucket.itemCount += 1;
      bucket.stockValue = roundTo4(bucket.stockValue + value);
      accountRows.set(accountId, bucket);

      // Per-item flags are data-integrity signals (negative stock, or stock
      // on hand with no recorded cost) — there is no per-item GL sub-ledger
      // to diff against, only the account-level total below.
      if (hasNegativeStock || hasMissingCost) {
        flaggedItems.push({
          itemId: item.id,
          itemCode: item.serial ?? null,
          itemName: item.arabicName || item.englishName || item.id,
          accountId,
          quantityOnHand,
          unitCost,
          value,
          hasNegativeStock,
          hasMissingCost,
        });
      }
    }

    const accountIds = [...accountRows.keys()];
    const accounts = accountIds.length
      ? await prisma.account.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, code: true, arabicName: true, englishName: true },
        })
      : [];
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    const accountBreakdown: InventoryGlAccountBreakdown[] = [];
    let glInventoryBalance = 0;
    let stockLedgerValue = 0;

    for (const [accountId, bucket] of accountRows.entries()) {
      const glBalance = await this.accountBalance(companyId, accountId);
      const variance = roundTo4(glBalance - bucket.stockValue);
      const account = accountById.get(accountId);
      accountBreakdown.push({
        accountId,
        accountCode: account?.code ?? '(unknown)',
        accountName: account?.arabicName || account?.englishName || '(unknown)',
        glBalance,
        stockLedgerValue: bucket.stockValue,
        variance,
        isReconciled: Math.abs(variance) <= EPS,
        itemCount: bucket.itemCount,
      });
      glInventoryBalance = roundTo4(glInventoryBalance + glBalance);
      stockLedgerValue = roundTo4(stockLedgerValue + bucket.stockValue);
    }

    accountBreakdown.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    flaggedItems.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    const variance = roundTo4(glInventoryBalance - stockLedgerValue);

    return {
      companyId,
      generatedAt: new Date().toISOString(),
      glInventoryBalance,
      stockLedgerValue,
      variance,
      isReconciled: Math.abs(variance) <= EPS,
      accountBreakdown,
      flaggedItems: flaggedItems.slice(0, 200),
    };
  }
}

export const inventoryGlReconciliationService = new InventoryGlReconciliationService();
