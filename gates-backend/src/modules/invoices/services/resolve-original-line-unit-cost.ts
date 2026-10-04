import type { Prisma } from '@prisma/client';
import { computePurchaseLineNetCost } from './purchase-line-net-cost';

type OriginalLineRow = {
  id: string;
  itemId: string;
  unitCostAtIssue: unknown;
  total: unknown;
  discountAmount: unknown;
  headerDiscountAllocated: unknown;
  quantity: unknown;
  baseQuantity: unknown;
  invoice: {
    id: string;
    invoiceKind: string | null;
    exchangeRate: unknown;
  };
};

/**
 * Unit cost on the original invoice line for return posting (MAC reversal / COGS restore).
 * Prefers persisted `unitCostAtIssue`; falls back to purchase net unit cost or the
 * outbound movement cost from the original sale post.
 */
export async function resolveOriginalLineUnitCostByLineId(
  tx: Prisma.TransactionClient,
  companyId: string,
  originalLineIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (originalLineIds.length === 0) return out;

  const rows = await tx.invoiceLine.findMany({
    where: { id: { in: originalLineIds } },
    select: {
      id: true,
      itemId: true,
      unitCostAtIssue: true,
      total: true,
      discountAmount: true,
      headerDiscountAllocated: true,
      quantity: true,
      baseQuantity: true,
      invoice: {
        select: { id: true, invoiceKind: true, exchangeRate: true },
      },
    },
  });

  const saleLinesMissingIssue: OriginalLineRow[] = [];

  for (const row of rows) {
    if (row.unitCostAtIssue != null) {
      out.set(row.id, Number(row.unitCostAtIssue));
      continue;
    }
    const kind = row.invoice.invoiceKind;
    if (kind === 'PURCHASE') {
      const rate = Number(row.invoice.exchangeRate ?? 1) || 1;
      const { unifiedNetUnitCost } = computePurchaseLineNetCost(row, rate);
      out.set(row.id, unifiedNetUnitCost);
      continue;
    }
    if (kind === 'SALE') {
      saleLinesMissingIssue.push(row as OriginalLineRow);
    }
  }

  if (saleLinesMissingIssue.length === 0) return out;

  const invoiceIds = [...new Set(saleLinesMissingIssue.map((l) => l.invoice.id))];
  const movements = await tx.inventoryMovement.findMany({
    where: {
      companyId,
      sourceDocumentId: { in: invoiceIds },
      quantityDelta: { lt: 0 },
      movementType: { in: ['SALE', 'SI'] },
    },
    select: {
      sourceDocumentId: true,
      itemId: true,
      unitCost: true,
      effectiveAt: true,
    },
    orderBy: { effectiveAt: 'desc' },
  });

  const movementCostByDocItem = new Map<string, number>();
  for (const mov of movements) {
    if (!mov.sourceDocumentId || mov.unitCost == null) continue;
    const key = `${mov.sourceDocumentId}:${mov.itemId}`;
    if (!movementCostByDocItem.has(key)) {
      movementCostByDocItem.set(key, Number(mov.unitCost));
    }
  }

  for (const line of saleLinesMissingIssue) {
    const fromMovement = movementCostByDocItem.get(`${line.invoice.id}:${line.itemId}`);
    if (fromMovement != null && Number.isFinite(fromMovement)) {
      out.set(line.id, fromMovement);
    }
  }

  return out;
}
