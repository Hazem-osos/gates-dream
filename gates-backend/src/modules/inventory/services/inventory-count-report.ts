export type CountUnit = {
  arabicName: string;
  conversionFactor: number;
  isBaseUnit: boolean;
};

export type CountItemFields = {
  serial: string;
  arabicName: string;
  barcode: string;
  groupName: string;
  orderLimit: number;
  lowerLimit: number;
  upperLimit: number;
  salesTaxPercent: number;
  isAssembly: boolean;
  isService: boolean;
  manufacturer: string;
  color: string;
  origin: string;
  quality: string;
  size: string;
  property1: string;
  property2: string;
  property3: string;
  property4: string;
  property5: string;
  salePrice: number;
  units: CountUnit[];
};

export type CountQuantityFlags = {
  /** Drop zero on-hand rows that are also not reserved. */
  hideEmpty: boolean;
  negativeOnly: boolean;
  nonNegativeOnly: boolean;
};

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function countFlag(value: unknown, fallback: boolean): boolean {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return fallback;
}

export function countText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Item-card filters for جرد الأصناف. Absent flags do not narrow the catalog. */
export function inventoryCountItemWhere(filters: Record<string, unknown>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const activeOnly = countFlag(filters.activeOnly, false);
  const inactiveOnly = countFlag(filters.inactiveOnly, false);
  if (activeOnly && !inactiveOnly) {
    where.isActive = true;
    where.inactiveItem = false;
  } else if (inactiveOnly && !activeOnly) {
    where.OR = [{ isActive: false }, { inactiveItem: true }];
  }
  const returnableOnly = countFlag(filters.returnableOnly, false);
  const nonReturnableOnly = countFlag(filters.nonReturnableOnly, false);
  if (returnableOnly && !nonReturnableOnly) where.cannotBeReturned = false;
  if (nonReturnableOnly && !returnableOnly) where.cannotBeReturned = true;
  const belowCostOnly = countFlag(filters.belowCostOnly, false);
  const noBelowCostOnly = countFlag(filters.noBelowCostOnly, false);
  if (belowCostOnly && !noBelowCostOnly) where.noSellBelowCost = false;
  if (noBelowCostOnly && !belowCostOnly) where.noSellBelowCost = true;

  const textFields: Array<[string, string]> = [
    ['manufacturerId', 'manufacturerId'],
    ['colorId', 'colorId'],
    ['countryOfOrigin', 'countryOfOrigin'],
    ['quality', 'quality'],
    ['size', 'size'],
    ['property1', 'property1'],
    ['property2', 'property2'],
    ['property3', 'property3'],
    ['property4', 'property4'],
    ['property5', 'property5'],
  ];
  for (const [queryKey, field] of textFields) {
    const text = countText(filters[queryKey]);
    if (text) where[field] = { contains: text };
  }
  return where;
}

export type CountLayout = 'flat' | 'group' | 'warehouse';

export function countLayout(showGroups: boolean, showWarehouse: boolean): CountLayout {
  if (showWarehouse) return 'warehouse';
  if (showGroups) return 'group';
  return 'flat';
}

export function paintReportLayout<T extends Record<string, unknown>>(
  rows: T[],
  filters: { showGroups?: unknown; showWarehouse?: unknown }
): T[] {
  return layoutInventoryCountRows(
    rows,
    countLayout(countFlag(filters.showGroups, false), countFlag(filters.showWarehouse, false))
  ) as T[];
}

export function layoutInventoryCountRows(
  rows: Array<Record<string, unknown>>,
  layout: CountLayout
): Array<Record<string, unknown>> {
  const sorted = [...rows].sort((a, b) => {
    if (layout === 'warehouse') {
      const warehouse = String(a.warehouseName || 'بدون مخزن').localeCompare(
        String(b.warehouseName || 'بدون مخزن'),
        'ar'
      );
      if (warehouse !== 0) return warehouse;
    }
    if (layout === 'group') {
      const group = String(a.groupName || a.itemGroupName || 'بدون مجموعة').localeCompare(
        String(b.groupName || b.itemGroupName || 'بدون مجموعة'),
        'ar'
      );
      if (group !== 0) return group;
    }
    const name = String(a.itemName ?? '').localeCompare(String(b.itemName ?? ''), 'ar');
    if (name !== 0) return name;
    return String(a.itemSerial ?? '').localeCompare(String(b.itemSerial ?? ''), 'ar');
  });
  if (layout === 'flat') {
    return sorted.map((row) => ({ ...row, accountPath: '', isGroup: false }));
  }

  const empty = layout === 'warehouse' ? 'بدون مخزن' : 'بدون مجموعة';
  return sorted.map((row) => {
    const name =
      layout === 'warehouse'
        ? String(row.warehouseName || empty)
        : String(row.groupName || row.itemGroupName || empty);
    return {
      ...row,
      accountPath: name,
      groupKey: name,
      isGroup: false,
    };
  });
}

/** Today or a future as-of date → read item_warehouse_balances (includes المحجوز). */
export function usesLiveWarehouseBalances(asOfDate?: Date, now = new Date()): boolean {
  if (!asOfDate) return true;
  const y = asOfDate.getUTCFullYear();
  const m = asOfDate.getUTCMonth();
  const d = asOfDate.getUTCDate();
  const ny = now.getUTCFullYear();
  const nm = now.getUTCMonth();
  const nd = now.getUTCDate();
  if (y === ny && m === nm && d === nd) return true;
  const asOfDay = Date.UTC(y, m, d);
  const todayDay = Date.UTC(ny, nm, nd);
  return asOfDay > todayDay;
}

export function keepCountBalance(
  quantityOnHand: number,
  reservedQuantity: number,
  flags: CountQuantityFlags
): boolean {
  if (flags.hideEmpty && quantityOnHand === 0 && reservedQuantity === 0) return false;
  if (flags.negativeOnly && flags.nonNegativeOnly) return true;
  if (flags.negativeOnly) return quantityOnHand < 0;
  if (flags.nonNegativeOnly) return quantityOnHand >= 0;
  return true;
}

/** Base unit first, then the other units in card order. Index is 1-based (وحدة رقم 2 = 2). */
export function orderedCountUnits(units: CountUnit[]): CountUnit[] {
  const base = units.filter((unit) => unit.isBaseUnit);
  const rest = units.filter((unit) => !unit.isBaseUnit);
  return [...base, ...rest];
}

export function inventoryCountRow(input: {
  itemId: string;
  warehouseId: string;
  warehouseName: string;
  quantityOnHand: number;
  reservedQuantity: number;
  warehouseAverageCost: number;
  itemAverageCost: number;
  totalQuantity: number;
  otherUnitIndex: number;
  exchangeRate: number;
  item: CountItemFields;
}) {
  const rate = input.exchangeRate > 0 ? input.exchangeRate : 1;
  const qty = round4(input.quantityOnHand);
  const reserved = round4(input.reservedQuantity);
  const cost = round4((input.warehouseAverageCost || input.itemAverageCost) / rate);
  const units = orderedCountUnits(input.item.units);
  const base = units[0];
  const other = input.otherUnitIndex > 0 ? units[input.otherUnitIndex - 1] : undefined;
  const factor = other && other.conversionFactor ? other.conversionFactor : 0;
  return {
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    itemSerial: input.item.serial,
    itemName: input.item.arabicName,
    groupName: input.item.groupName,
    barcode: input.item.barcode,
    warehouseName: input.warehouseName,
    quantityOnHand: qty,
    reservedQuantity: reserved,
    availableQty: round4(qty - reserved),
    totalQuantity: round4(input.totalQuantity),
    baseUnitName: base?.arabicName ?? '',
    otherUnitName: other?.arabicName ?? '',
    otherQuantity: factor ? round4(qty / factor) : null,
    averageCost: cost,
    stockValue: round4(qty * cost),
    upperLimit: input.item.upperLimit,
    lowerLimit: input.item.lowerLimit,
    orderLimit: input.item.orderLimit,
    itemNature: input.item.isAssembly ? 'تجميعي' : 'عادي',
    itemKind: input.item.isService ? 'خدمة' : 'سلعة',
    salesTaxPercent: input.item.salesTaxPercent,
    salePrice: round4(input.item.salePrice / rate),
    manufacturer: input.item.manufacturer,
    color: input.item.color,
    origin: input.item.origin,
    quality: input.item.quality,
    size: input.item.size,
    property1: input.item.property1,
    property2: input.item.property2,
    property3: input.item.property3,
    property4: input.item.property4,
    property5: input.item.property5,
  };
}

/** Grand totals for جرد الأصناف footer / Excel (excludes group header rows). */
export function inventoryCountSummaryTotalsFromRows(rows: Array<Record<string, unknown>>) {
  const dataRows = rows.filter((row) => row.isGroup !== true);
  let quantityOnHand = 0;
  let reservedQuantity = 0;
  let stockValue = 0;
  let otherQuantity = 0;
  for (const row of dataRows) {
    quantityOnHand += Number(row.quantityOnHand) || 0;
    reservedQuantity += Number(row.reservedQuantity) || 0;
    stockValue += Number(row.stockValue) || 0;
    otherQuantity += Number(row.otherQuantity) || 0;
  }
  const columnTotals = {
    quantityOnHand: round4(quantityOnHand),
    reservedQuantity: round4(reservedQuantity),
    availableQty: round4(quantityOnHand - reservedQuantity),
    stockValue: round4(stockValue),
    otherQuantity: round4(otherQuantity),
  };
  return {
    totalQuantity: columnTotals.quantityOnHand,
    totalValue: columnTotals.stockValue,
    columnTotals,
  };
}
