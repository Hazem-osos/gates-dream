import { roundTo4 } from '../../../shared/utils/decimal-round';
import { quantityTimesPrice } from '../../contracting/services/extract-boq-calculation.util';
import { hasChildren, leafItems } from '../../contracting/utils/boq-hierarchy.util';

export type WorkItemForExtract = {
  id: string;
  parentId: string | null;
  isExecutable: boolean;
  itemNumber: string;
  arabicName: string;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
};

export type ExtractLineInput = {
  workItemId?: string | null;
  buildingId?: string | null;
  unitNumber?: string | null;
  modelNumber?: string | null;
  groupCode?: string | null;
  groupName?: string | null;
  itemNumber?: string | null;
  itemName: string;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  notes?: string | null;
};

export type ComputedExtractLine = ExtractLineInput & {
  previousQuantity: number;
  currentQuantity: number;
  cumulativeQuantity: number;
  remainingQuantity: number;
  previousAmount: number | null;
  currentAmount: number | null;
  cumulativeAmount: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
};

/**
 * Current-period line total. Client `totalPrice` is ignored.
 * Formula: round4(currentQuantity × unitPrice).
 */
export function computeExtractLineTotal(currentQuantity: number, unitPrice: number | null | undefined): number | null {
  if (unitPrice == null) return null;
  return quantityTimesPrice(currentQuantity, unitPrice);
}

/** Cancelled extracts never occupy remaining BOQ qty. Drafts do. */
export function occupiesLegacyExtractRemaining(extract: { isCancelled?: boolean }): boolean {
  return extract.isCancelled !== true;
}

export function aggregatePreviousWorkItemQuantities(
  extracts: Array<{
    isCancelled?: boolean;
    items: Array<{ workItemId?: string | null; quantity: number }>;
  }>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const extract of extracts) {
    if (!occupiesLegacyExtractRemaining(extract)) continue;
    for (const item of extract.items) {
      if (!item.workItemId) continue;
      map[item.workItemId] = roundTo4((map[item.workItemId] ?? 0) + Number(item.quantity));
    }
  }
  return map;
}

export function remainingFromContract(contractQty: number, cumulativeQty: number): number {
  return roundTo4(Math.max(0, roundTo4(contractQty) - roundTo4(cumulativeQty)));
}

export function attachRemainingQuantity<
  T extends { workItem?: { quantity?: unknown } | null; cumulativeQuantity?: unknown },
>(items: T[]): Array<T & { remainingQuantity: number }> {
  return items.map((item) => ({
    ...item,
    remainingQuantity: remainingFromContract(
      item.workItem ? Number(item.workItem.quantity) : 0,
      Number(item.cumulativeQuantity ?? 0)
    ),
  }));
}

export function computeWorkItemTotal(quantity: number, unitPrice: number | null | undefined): number | null {
  if (unitPrice == null) return null;
  return quantityTimesPrice(quantity, unitPrice);
}

export function assertExtractLineInputs(
  lines: ExtractLineInput[],
  workItems: WorkItemForExtract[]
): void {
  if (!lines.length) {
    throw new Error('EXTRACT_ITEMS_REQUIRED');
  }
  const byId = new Map(workItems.map((row) => [row.id, row]));
  const seenWorkItems = new Set<string>();

  for (const line of lines) {
    if (!Number.isFinite(line.quantity) || (line.unitPrice != null && !Number.isFinite(line.unitPrice))) {
      throw new Error('EXTRACT_NON_FINITE_AMOUNT');
    }
    if (line.quantity < 0) {
      throw new Error('EXTRACT_NEGATIVE_QUANTITY');
    }
    if (line.unitPrice != null && line.unitPrice < 0) {
      throw new Error('EXTRACT_NEGATIVE_PRICE');
    }
    if (!line.workItemId) continue;
    if (seenWorkItems.has(line.workItemId)) {
      throw new Error(`EXTRACT_DUPLICATE_WORK_ITEM:${line.workItemId}`);
    }
    seenWorkItems.add(line.workItemId);
    const workItem = byId.get(line.workItemId);
    if (!workItem) {
      throw new Error('EXTRACT_WORK_ITEM_NOT_FOUND');
    }
    if (hasChildren(workItems, workItem.id) || workItem.isExecutable === false) {
      throw new Error(`EXTRACT_HEADER_NOT_CERTIFIABLE:${workItem.itemNumber}`);
    }
  }
}

export function computeExtractLines(params: {
  lines: ExtractLineInput[];
  workItems: WorkItemForExtract[];
  previousQuantityByWorkItemId: Record<string, number>;
}): { lines: ComputedExtractLine[]; totalValue: number } {
  assertExtractLineInputs(params.lines, params.workItems);
  const byId = new Map(params.workItems.map((row) => [row.id, row]));

  const computed: ComputedExtractLine[] = params.lines.map((line) => {
    const workItem = line.workItemId ? byId.get(line.workItemId) : undefined;
    const currentQuantity = roundTo4(line.quantity);
    const previousQuantity = roundTo4(
      line.workItemId ? params.previousQuantityByWorkItemId[line.workItemId] ?? 0 : 0
    );
    const cumulativeQuantity = roundTo4(previousQuantity + currentQuantity);
    const unitPrice =
      line.unitPrice != null
        ? roundTo4(line.unitPrice)
        : workItem?.unitPrice != null
          ? roundTo4(workItem.unitPrice)
          : null;
    const totalPrice = computeExtractLineTotal(currentQuantity, unitPrice);
    const previousAmount = computeExtractLineTotal(previousQuantity, unitPrice);
    const cumulativeAmount = computeExtractLineTotal(cumulativeQuantity, unitPrice);
    const contractQty = workItem ? roundTo4(workItem.quantity) : 0;
    const remainingQuantity = roundTo4(Math.max(0, contractQty - cumulativeQuantity));

    if (workItem) {
      if (contractQty > 0 && cumulativeQuantity > contractQty + 1e-6) {
        throw new Error(
          `EXTRACT_QTY_EXCEEDS_BOQ:${workItem.itemNumber}:${cumulativeQuantity}:${contractQty}`
        );
      }
    }

    return {
      ...line,
      quantity: currentQuantity,
      previousQuantity,
      currentQuantity,
      cumulativeQuantity,
      remainingQuantity,
      previousAmount,
      currentAmount: totalPrice,
      cumulativeAmount,
      unitPrice,
      totalPrice,
      itemName: line.itemName || workItem?.arabicName || line.itemName,
      itemNumber: line.itemNumber ?? workItem?.itemNumber ?? null,
      unit: line.unit ?? workItem?.unit ?? null,
    };
  });

  const totalValue = roundTo4(
    computed.reduce((sum, line) => sum + (line.totalPrice ?? 0), 0)
  );

  return { lines: computed, totalValue };
}

export function workItemContractValue(items: WorkItemForExtract[]): number {
  return roundTo4(
    leafItems(items).reduce((sum, item) => {
      if (item.unitPrice == null) return sum;
      return sum + quantityTimesPrice(item.quantity, item.unitPrice);
    }, 0)
  );
}
