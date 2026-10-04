export type OpeningValuationLine = {
  warehouseId: string;
  itemId?: string | null;
  quantity: unknown;
  unitPrice: unknown;
  batchNumber?: string | null;
  expiryDate?: Date | string | null;
};

export type OpeningValuationDoc = {
  id: string;
  isPosted: boolean;
  updatedAt: Date | string;
  lines: OpeningValuationLine[];
};

/**
 * Whether opening-stock quantity is on the warehouse ledger (document posted).
 */
export function openingStockInventoryStillApplied(doc: {
  isCancelled: boolean;
  isPosted: boolean;
  journalEntryId?: string | null;
}): boolean {
  if (doc.isCancelled) return false;
  return doc.isPosted === true;
}

/**
 * One opening stock owns each warehouse. A posted document wins over a draft.
 * When both are posted, the newer one keeps the overlapping warehouse and the
 * older document still contributes its other warehouses.
 */
export function openingLinesWithoutWarehouseOverlap(docs: OpeningValuationDoc[]): OpeningValuationDoc[] {
  const ranked = [...docs].sort((a, b) => {
    if (a.isPosted !== b.isPosted) return a.isPosted ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  const claimed = new Set<string>();
  const kept: OpeningValuationDoc[] = [];
  for (const doc of ranked) {
    const free = [
      ...new Set(doc.lines.map((line) => String(line.warehouseId || '').trim()).filter(Boolean)),
    ].filter((warehouseId) => !claimed.has(warehouseId));
    if (free.length === 0) continue;
    for (const warehouseId of free) claimed.add(warehouseId);
    const freeSet = new Set(free);
    kept.push({
      ...doc,
      lines: doc.lines.filter((line) => freeSet.has(String(line.warehouseId || '').trim())),
    });
  }
  return kept;
}

export function duplicateOpeningStockLine(lines: OpeningValuationLine[]): boolean {
  const seen = new Set<string>();
  for (const line of lines) {
    const warehouseId = String(line.warehouseId || '').trim();
    if (!line.itemId || !warehouseId) continue;
    const batch = String(line.batchNumber ?? '').trim();
    const expiry = line.expiryDate ? String(line.expiryDate).slice(0, 10) : '';
    const key = `${line.itemId}|${warehouseId}|${batch}|${expiry}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
