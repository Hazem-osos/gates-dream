import prisma from '../../../shared/database/prisma';

export type ItemStockSummary = {
  quantityOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  /** @deprecated Picker alias — equals availableQuantity, not physical on-hand. */
  onHandQuantity: number;
};

/** Sum warehouse balances per item (optional single-warehouse scope). */
export async function stockSummariesForItems(
  companyId: string,
  itemIds: string[],
  warehouseId?: string
): Promise<Map<string, ItemStockSummary>> {
  const out = new Map<string, ItemStockSummary>();
  if (!itemIds.length) return out;

  const rows = await prisma.itemWarehouseBalance.groupBy({
    by: ['itemId'],
    where: {
      companyId,
      itemId: { in: itemIds },
      ...(warehouseId ? { warehouseId } : {}),
    },
    _sum: {
      quantityOnHand: true,
      reservedQuantity: true,
    },
  });

  for (const row of rows) {
    const quantityOnHand = Number(row._sum.quantityOnHand ?? 0);
    const reservedQuantity = Number(row._sum.reservedQuantity ?? 0);
    const availableQuantity = Math.max(0, quantityOnHand - reservedQuantity);
    out.set(row.itemId, {
      quantityOnHand,
      reservedQuantity,
      availableQuantity,
      onHandQuantity: availableQuantity,
    });
  }
  return out;
}

export function attachStockSummaries<T extends { id: string }>(
  items: T[],
  summaries: Map<string, ItemStockSummary>
): Array<T & Partial<ItemStockSummary>> {
  return items.map((item) => {
    const summary = summaries.get(item.id);
    return summary ? { ...item, ...summary } : item;
  });
}
