import { itemProfitRatios } from './item-profit-ratios';

export type StockProfitPriceTier =
  | 'wholesale'
  | 'semi'
  | 'export'
  | 'representative'
  | 'pos'
  | 'consumer';

export type StockProfitUnit = {
  conversionFactor: number;
  isBaseUnit: boolean;
  arabicName?: string;
};

export type StockProfitItem = {
  id: string;
  serial: string;
  arabicName: string;
  groupName: string;
  priceWholesale: number;
  priceSemiWholesale: number;
  exportPrice: number;
  representativePrice: number;
  priceRetail: number;
  retailPrice: number;
  consumerPrice: number;
  averageCost: number;
  /** Resolved sale price. When omitted, the old tier on the item card is used. */
  salePrice?: number;
  units: StockProfitUnit[];
};

export type StockProfitBalance = {
  itemId: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  averageCost: number;
};

export type StockProfitOptions = {
  priceTier?: string;
  /** 1-based slot on the item card. 2 = الوحدة الأخرى «وحدة رقم 2». */
  otherUnitIndex?: number;
  showEmpty?: boolean;
  showWarehouse?: boolean;
  showGroups?: boolean;
  negativeOnly?: boolean;
  nonNegativeOnly?: boolean;
  /** Company rate of the selected currency. Money is shown as base / rate. */
  exchangeRate?: number;
};

export type StockProfitRow = {
  isGroup?: boolean;
  itemId: string;
  groupName: string;
  warehouseName: string;
  itemSerial: string;
  itemName: string;
  unitName: string;
  quantity: number | null;
  otherQuantity: number | null;
  salePrice: number | null;
  saleValue: number | null;
  unitCost: number | null;
  costValue: number | null;
  profit: number | null;
  profitPercent: number | null;
  profitPercentOnSales: number | null;
  profitPercentOnCost: number | null;
  profitPercentOnTotal: number | null;
};

function baseUnitName(item: StockProfitItem): string {
  const base = item.units.find((unit) => unit.isBaseUnit) ?? item.units[0];
  return base?.arabicName?.trim() || '';
}

function chosenSalePrice(item: StockProfitItem, tier: string): number {
  if (item.salePrice != null && Number.isFinite(item.salePrice)) return item.salePrice;
  return tierPrice(item, tier);
}

function tierPrice(item: StockProfitItem, tier: string): number {
  switch (tier) {
    case 'semi':
      return item.priceSemiWholesale;
    case 'export':
      return item.exportPrice;
    case 'representative':
      return item.representativePrice;
    case 'pos':
      return item.priceRetail || item.retailPrice;
    case 'consumer':
      return item.consumerPrice;
    default:
      return item.priceWholesale;
  }
}

function otherQuantity(item: StockProfitItem, baseQty: number, unitIndex: number): number | null {
  if (!unitIndex || unitIndex < 1) return null;
  const units = [...item.units].sort((a, b) => Number(b.isBaseUnit) - Number(a.isBaseUnit));
  const unit = units[unitIndex - 1];
  if (!unit) return null;
  const factor = unit.conversionFactor;
  if (!Number.isFinite(factor) || factor === 0) return null;
  return baseQty / factor;
}

function money(value: number, rate: number): number {
  const divisor = rate > 0 ? rate : 1;
  return value / divisor;
}

type Detail = {
  itemId: string;
  groupName: string;
  warehouseName: string;
  itemSerial: string;
  itemName: string;
  unitName: string;
  quantity: number;
  otherQuantity: number | null;
  salePrice: number;
  saleValue: number;
  unitCost: number;
  costValue: number;
  profit: number;
  profitPercent: number;
};

function toDetail(
  item: StockProfitItem,
  quantity: number,
  unitCost: number,
  warehouseName: string,
  options: Required<Pick<StockProfitOptions, 'priceTier' | 'otherUnitIndex' | 'exchangeRate'>>
): Detail {
  const price = chosenSalePrice(item, options.priceTier);
  const saleValue = quantity * price;
  const costValue = quantity * unitCost;
  const profit = saleValue - costValue;
  const rate = options.exchangeRate;
  return {
    itemId: item.id,
    groupName: item.groupName || 'بدون مجموعة',
    warehouseName: warehouseName || 'بدون مخزن',
    itemSerial: item.serial,
    itemName: item.arabicName,
    unitName: baseUnitName(item),
    quantity,
    otherQuantity: otherQuantity(item, quantity, options.otherUnitIndex),
    salePrice: money(price, rate),
    saleValue: money(saleValue, rate),
    unitCost: money(unitCost, rate),
    costValue: money(costValue, rate),
    profit: money(profit, rate),
    profitPercent: saleValue !== 0 ? (profit / saleValue) * 100 : 0,
  };
}

function passesSign(quantity: number, options: StockProfitOptions): boolean {
  if (options.negativeOnly && options.nonNegativeOnly) return true;
  if (options.negativeOnly) return quantity < 0;
  if (options.nonNegativeOnly) return quantity >= 0;
  return true;
}

export function buildStockValuationProfit(
  items: StockProfitItem[],
  balances: StockProfitBalance[],
  options: StockProfitOptions = {}
): { rows: StockProfitRow[]; summary: { totalQuantity: number; saleValue: number; costValue: number; totalProfit: number } } {
  const opts = {
    priceTier: options.priceTier || 'wholesale',
    otherUnitIndex: options.otherUnitIndex ?? 2,
    showEmpty: Boolean(options.showEmpty),
    showWarehouse: Boolean(options.showWarehouse),
    showGroups: Boolean(options.showGroups),
    negativeOnly: Boolean(options.negativeOnly),
    nonNegativeOnly: Boolean(options.nonNegativeOnly),
    exchangeRate: options.exchangeRate && options.exchangeRate > 0 ? options.exchangeRate : 1,
  };

  const itemById = new Map(items.map((item) => [item.id, item]));
  const buckets = new Map<string, { item: StockProfitItem; warehouseName: string; quantity: number; costValue: number }>();

  const touch = (item: StockProfitItem, warehouseName: string, quantity: number, cost: number) => {
    const warehouse = warehouseName || 'بدون مخزن';
    const key = `${item.id}\0${warehouse}`;
    const current = buckets.get(key) ?? { item, warehouseName: warehouse, quantity: 0, costValue: 0 };
    current.quantity += quantity;
    current.costValue += quantity * cost;
    buckets.set(key, current);
  };

  for (const balance of balances) {
    const item = itemById.get(balance.itemId);
    if (!item) continue;
    const cost = balance.averageCost || item.averageCost;
    touch(item, balance.warehouseName, balance.quantity, cost);
  }

  if (opts.showEmpty) {
    for (const item of items) {
      const seen = [...buckets.values()].some((row) => row.item.id === item.id);
      if (!seen) touch(item, '', 0, item.averageCost);
    }
  }

  const details: Detail[] = [];
  for (const bucket of buckets.values()) {
    if (!opts.showEmpty && bucket.quantity === 0) continue;
    if (!passesSign(bucket.quantity, opts)) continue;
    const unitCost = bucket.quantity !== 0 ? bucket.costValue / bucket.quantity : bucket.item.averageCost;
    details.push(
      toDetail(bucket.item, bucket.quantity, unitCost, bucket.warehouseName, {
        priceTier: opts.priceTier,
        otherUnitIndex: opts.otherUnitIndex,
        exchangeRate: opts.exchangeRate,
      })
    );
  }

  details.sort((a, b) => {
    const group = a.groupName.localeCompare(b.groupName, 'ar');
    if (group !== 0) return group;
    const name = a.itemName.localeCompare(b.itemName, 'ar');
    if (name !== 0) return name;
    return a.warehouseName.localeCompare(b.warehouseName, 'ar');
  });

  const summary = details.reduce(
    (sum, row) => ({
      totalQuantity: sum.totalQuantity + row.quantity,
      saleValue: sum.saleValue + row.saleValue,
      costValue: sum.costValue + row.costValue,
      totalProfit: sum.totalProfit + row.profit,
    }),
    { totalQuantity: 0, saleValue: 0, costValue: 0, totalProfit: 0 }
  );

  const rows = details.map((row) => ({
    ...row,
    ...itemProfitRatios(
      { totalProfit: row.profit, totalSales: row.saleValue, totalCost: row.costValue },
      summary.totalProfit
    ),
  }));

  return { rows, summary };
}
