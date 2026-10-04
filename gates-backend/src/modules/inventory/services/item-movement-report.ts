import { roundTo4 } from '../../../shared/utils/decimal-round';

export type ItemMovementSide = 'in' | 'out' | 'opening';

/** One commercial or stock line, already scoped to the company and the filters. */
export type ItemMovementSourceLine = {
  date: Date;
  sourceLabel: string;
  sourceNumber: string;
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  partyName: string;
  description: string;
  unitName: string;
  side: ItemMovementSide;
  quantity: number;
  price: number;
  total: number;
  itemGroupName: string;
  color: string;
  origin: string;
  quality: string;
  size: string;
  upperLimit: number;
  costCenterId?: string;
  costCenterName: string;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  expiryDate: string | null;
  delegateName: string;
  /** Purchase and sale unit prices feed the min/avg/max columns. Stock cost does not. */
  priceKind: 'purchase' | 'sale' | 'none';
  sourceDocumentId: string;
  sourceType: string;
  /** Moving average of the item after this movement. */
  averageCost: number;
  itemSerial: string;
  barcode: string;
  manufacturer: string;
  property1: string;
  property2: string;
  property3: string;
  property4: string;
  property5: string;
  lowerLimit: number;
  orderLimit: number;
};

export type ItemMovementSheetRow = {
  date: string;
  sourceLabel: string;
  sourceNumber: string;
  itemName: string;
  warehouseName: string;
  partyName: string;
  description: string;
  unitName: string;
  inQty: number | null;
  inPrice: number | null;
  inTotal: number | null;
  outQty: number | null;
  outPrice: number | null;
  outTotal: number | null;
  balance: number;
  itemGroupName: string;
  color: string;
  origin: string;
  quality: string;
  size: string;
  upperLimit: number | null;
  minPurchasePrice: number | null;
  avgPurchasePrice: number | null;
  maxPurchasePrice: number | null;
  minSalePrice: number | null;
  avgSalePrice: number | null;
  maxSalePrice: number | null;
  costCenterName: string;
  discountPercent: number | null;
  discountAmount: number | null;
  taxPercent: number | null;
  taxAmount: number | null;
  expiryDate: string | null;
  delegateName: string;
  groupKey: string;
  sourceDocumentId: string;
  sourceType: string;
  averageCost: number | null;
  itemSerial: string;
  barcode: string;
  manufacturer: string;
  property1: string;
  property2: string;
  property3: string;
  property4: string;
  property5: string;
  lowerLimit: number | null;
  orderLimit: number | null;
};

export type ItemMovementSummary = {
  totalInQty: number;
  totalInAmount: number;
  totalOutQty: number;
  totalOutAmount: number;
  totalDiscount: number;
  qtyDifference: number;
};

const INVOICE_STOCK_SOURCES = new Set(['PI', 'SI', 'PR', 'SR', 'INV']);

/** Stock rows created by posting an invoice. The report shows the invoice line instead. */
export function isInvoiceStockMovement(sourceType: string | null | undefined): boolean {
  if (!sourceType) return false;
  const base = sourceType.replace(/-COGS$/, '').replace(/-UNPOST$/, '');
  return INVOICE_STOCK_SOURCES.has(base);
}

export function expandTreeIds(
  rootId: string,
  rows: Array<{ id: string; parentId: string | null | undefined }>
): string[] {
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const list = children.get(row.parentId) ?? [];
    list.push(row.id);
    children.set(row.parentId, list);
  }
  const ids = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    for (const child of children.get(id) ?? []) stack.push(child);
  }
  return [...ids];
}

function blankToNull(value: number): number | null {
  return value ? roundTo4(value) : null;
}

function priceStats(prices: number[]): { min: number | null; avg: number | null; max: number | null } {
  if (!prices.length) return { min: null, avg: null, max: null };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  return { min: roundTo4(min), avg: roundTo4(avg), max: roundTo4(max) };
}

function movementBalanceKey(
  line: ItemMovementSourceLine,
  groupBy: 'none' | 'warehouse' | 'groups' | 'costCenter'
): string {
  if (groupBy === 'costCenter') {
    return `${line.costCenterId || line.costCenterName || 'none'}|${line.itemId}|${line.warehouseId}`;
  }
  return `${line.itemId}|${line.warehouseId}`;
}

function movementDisplayKey(
  line: ItemMovementSourceLine,
  groupBy: 'none' | 'warehouse' | 'groups' | 'costCenter'
): string {
  if (groupBy === 'costCenter') {
    return `${line.costCenterId || line.costCenterName || 'none'}|${line.itemId}|${line.warehouseId}`;
  }
  if (groupBy === 'groups') {
    return line.itemGroupName || 'بدون مجموعة';
  }
  if (groupBy === 'warehouse') {
    return line.warehouseName || 'بدون مخزن';
  }
  return '';
}

function compareMovementLines(a: ItemMovementSourceLine, b: ItemMovementSourceLine): number {
  if (a.side === 'opening' && b.side !== 'opening') return -1;
  if (b.side === 'opening' && a.side !== 'opening') return 1;
  const byDate = a.date.getTime() - b.date.getTime();
  if (byDate) return byDate;
  return a.sourceNumber.localeCompare(b.sourceNumber, 'ar');
}

/**
 * Writes a running quantity balance per item and warehouse (or per cost
 * center, item, and warehouse). Display stays a flat date list unless
 * warehouse, item-group, or cost-center grouping is requested.
 * Opening stock is also an inbound (or an outbound when the carried
 * quantity is negative) so it shows in those columns.
 */
export function buildItemMovementSheet(
  lines: ItemMovementSourceLine[],
  options: { groupBy?: 'none' | 'warehouse' | 'groups' | 'costCenter' } = {}
): {
  rows: ItemMovementSheetRow[];
  summary: ItemMovementSummary;
} {
  const groupBy = options.groupBy ?? 'none';
  const purchasePrices = new Map<string, number[]>();
  const salePrices = new Map<string, number[]>();
  for (const line of lines) {
    if (line.side === 'opening' || line.priceKind === 'none' || !line.price) continue;
    const bucket = line.priceKind === 'purchase' ? purchasePrices : salePrices;
    const list = bucket.get(line.itemId) ?? [];
    list.push(line.price);
    bucket.set(line.itemId, list);
  }

  const buckets = new Map<string, ItemMovementSourceLine[]>();
  for (const line of lines) {
    const key = movementBalanceKey(line, groupBy);
    const list = buckets.get(key) ?? [];
    list.push(line);
    buckets.set(key, list);
  }

  const rows: ItemMovementSheetRow[] = [];
  let totalInQty = 0;
  let totalInAmount = 0;
  let totalOutQty = 0;
  let totalOutAmount = 0;
  let totalDiscount = 0;

  for (const group of buckets.values()) {
    group.sort(compareMovementLines);

    const itemId = group[0]?.itemId ?? '';
    const purchase = priceStats(purchasePrices.get(itemId) ?? []);
    const sale = priceStats(salePrices.get(itemId) ?? []);
    let balance = 0;

    for (const line of group) {
      const qty = roundTo4(Math.abs(line.quantity));
      const total = roundTo4(Math.abs(line.total));
      const price = roundTo4(Math.abs(line.price));
      const openingInbound = line.side === 'opening' && line.quantity >= 0;
      const openingOutbound = line.side === 'opening' && line.quantity < 0;
      if (line.side === 'opening') {
        balance = roundTo4(line.quantity);
      } else if (line.side === 'in') {
        balance = roundTo4(balance + qty);
      } else {
        balance = roundTo4(balance - qty);
      }
      const inbound = line.side === 'in' || openingInbound;
      const outbound = line.side === 'out' || openingOutbound;
      if (inbound) {
        totalInQty = roundTo4(totalInQty + qty);
        totalInAmount = roundTo4(totalInAmount + total);
      }
      if (outbound) {
        totalOutQty = roundTo4(totalOutQty + qty);
        totalOutAmount = roundTo4(totalOutAmount + total);
      }
      if (line.side !== 'opening') {
        totalDiscount = roundTo4(totalDiscount + Math.abs(line.discountAmount));
      }
      rows.push({
        date: line.date.toISOString(),
        sourceLabel: line.sourceLabel,
        sourceNumber: line.sourceNumber,
        itemName: line.itemName,
        warehouseName: line.warehouseName,
        partyName: line.partyName,
        description: line.description,
        unitName: line.unitName,
        inQty: inbound ? qty : null,
        inPrice: inbound ? price : null,
        inTotal: inbound ? total : null,
        outQty: outbound ? qty : null,
        outPrice: outbound ? price : null,
        outTotal: outbound ? total : null,
        balance,
        itemGroupName: line.itemGroupName,
        color: line.color,
        origin: line.origin,
        quality: line.quality,
        size: line.size,
        upperLimit: line.upperLimit ? roundTo4(line.upperLimit) : null,
        minPurchasePrice: purchase.min,
        avgPurchasePrice: purchase.avg,
        maxPurchasePrice: purchase.max,
        minSalePrice: sale.min,
        avgSalePrice: sale.avg,
        maxSalePrice: sale.max,
        costCenterName: line.costCenterName,
        discountPercent: line.side === 'opening' ? null : blankToNull(line.discountPercent),
        discountAmount: line.side === 'opening' ? null : blankToNull(line.discountAmount),
        taxPercent: line.side === 'opening' ? null : blankToNull(line.taxPercent),
        taxAmount: line.side === 'opening' ? null : blankToNull(line.taxAmount),
        expiryDate: line.expiryDate,
        delegateName: line.delegateName,
        groupKey: movementDisplayKey(line, groupBy),
        sourceDocumentId: line.sourceDocumentId,
        sourceType: line.sourceType,
        averageCost: line.averageCost ? roundTo4(line.averageCost) : null,
        itemSerial: line.itemSerial,
        barcode: line.barcode,
        manufacturer: line.manufacturer,
        property1: line.property1,
        property2: line.property2,
        property3: line.property3,
        property4: line.property4,
        property5: line.property5,
        lowerLimit: line.lowerLimit ? roundTo4(line.lowerLimit) : null,
        orderLimit: line.orderLimit ? roundTo4(line.orderLimit) : null,
      });
    }
  }

  rows.sort((a, b) => {
    if (groupBy === 'costCenter') {
      const center = (a.costCenterName ?? '').localeCompare(b.costCenterName ?? '', 'ar');
      if (center) return center;
    }
    if (groupBy === 'warehouse') {
      const warehouse = (a.warehouseName ?? '').localeCompare(b.warehouseName ?? '', 'ar');
      if (warehouse) return warehouse;
    }
    if (groupBy === 'groups') {
      const group = (a.itemGroupName ?? '').localeCompare(b.itemGroupName ?? '', 'ar');
      if (group) return group;
    }
    if (groupBy !== 'none') {
      const name = (a.itemName ?? '').localeCompare(b.itemName ?? '', 'ar');
      if (name) return name;
      if (groupBy !== 'warehouse') {
        const warehouse = (a.warehouseName ?? '').localeCompare(b.warehouseName ?? '', 'ar');
        if (warehouse) return warehouse;
      }
    }
    const timeA = Date.parse(a.date) || 0;
    const timeB = Date.parse(b.date) || 0;
    if (timeA !== timeB) return timeA - timeB;
    return (a.sourceNumber ?? '').localeCompare(b.sourceNumber ?? '', 'ar');
  });

  return {
    rows,
    summary: {
      totalInQty,
      totalInAmount,
      totalOutQty,
      totalOutAmount,
      totalDiscount,
      qtyDifference: roundTo4(totalInQty - totalOutQty),
    },
  };
}
