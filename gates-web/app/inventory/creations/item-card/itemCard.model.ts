export type ItemUnitRow = {
  id?: string;
  unitId?: string;
  conversionFactor: number | string;
  isFactorFixed?: boolean;
  isBaseUnit: boolean;
  unit?: { id?: string; arabicName?: string; code?: string };
};

export type AssemblyRow = {
  itemName: string;
  quantity: string;
  cost: string;
};

export type SupplierRow = {
  supplierName: string;
  price: string;
  leadTimeDays: string;
};

export type ItemDetail = {
  id: string;
  serial?: string | null;
  arabicName: string;
  englishName?: string | null;
  itemType?: string | null;
  mainAccountId?: string | null;
  costCenterId?: string | null;
  categoryId?: string | null;
  barcode?: string | null;
  defaultTaxPercent?: number | string | null;
  specifications?: string | null;
  weight?: number | string | null;
  manufacturerId?: string | null;
  colorId?: string | null;
  countryOfOrigin?: string | null;
  quality?: string | null;
  size?: string | null;
  property1?: string | null;
  property2?: string | null;
  property3?: string | null;
  property4?: string | null;
  property5?: string | null;
  orderLimit?: number | string | null;
  orderLimitPercentage?: number | string | null;
  upperLimit?: number | string | null;
  lowerLimit?: number | string | null;
  beginningBalance?: number | string | null;
  beginningCostPrice?: number | string | null;
  units?: ItemUnitRow[];
  quantities?: { quantity?: number | string; warehouse?: { arabicName?: string } }[];
  prices?: { price: number | string; unitId?: string; unit?: { arabicName?: string } }[];
  priceRetail?: number | string | null;
  priceSemiWholesale?: number | string | null;
  priceWholesale?: number | string | null;
  priceProjects?: number | string | null;
  isService?: boolean | null;
  isAssembly?: boolean | null;
  isTaxExempt?: boolean | null;
  consumerPrice?: number | string | null;
  retailPrice?: number | string | null;
  representativePrice?: number | string | null;
  exportPrice?: number | string | null;
  useExpirationDate?: boolean | null;
  inactiveItem?: boolean | null;
  notSubjectToTerms?: boolean | null;
  cannotBeReturned?: boolean | null;
  noSellBelowCost?: boolean | null;
  useSerialNumber?: boolean | null;
  clothingItem?: boolean | null;
  priceMode?: string | null;
  priceCurrency?: string | null;
  extraAssemblyCost?: number | string | null;
  extraAssemblyCostPct?: number | string | null;
  purchaseCount?: number | string | null;
  minPurchaseQty?: number | string | null;
  assemblyComponents?: unknown;
  preferredSuppliers?: unknown;
  imageUrl?: string | null;
  defaultWarehouseId?: string | null;
  priceSource?: string | null;
  lastPurchasePrice?: number | string | null;
};

export const EMPTY_ASSEMBLY_ROW: AssemblyRow = { itemName: '', quantity: '', cost: '' };
export const EMPTY_SUPPLIER_ROW: SupplierRow = { supplierName: '', price: '', leadTimeDays: '' };

export const EMPTY_ITEM_FORM = {
  serial: '',
  arabicName: '',
  englishName: '',
  categoryId: '',
  barcode: '',
  defaultTaxPercent: '',
  mainAccountId: '',
  costCenterId: '',
  specifications: '',
  weight: '',
  manufacturerId: '',
  colorId: '',
  countryOfOrigin: '',
  quality: '',
  size: '',
  property1: '',
  property2: '',
  property3: '',
  property4: '',
  property5: '',
  useExpirationDate: false,
  inactiveItem: false,
  notSubjectToTerms: false,
  cannotBeReturned: false,
  noSellBelowCost: false,
  useSerialNumber: false,
  clothingItem: false,
  upperLimit: '',
  orderLimit: '',
  orderLimitPercentage: '',
  lowerLimit: '',
  beginningBalance: '',
  beginningCostPrice: '',
  priceRetail: '',
  priceSemiWholesale: '',
  priceWholesale: '',
  priceProjects: '',
  isService: false,
  isAssembly: false,
  isTaxExempt: false,
  consumerPrice: '',
  retailPrice: '',
  representativePrice: '',
  exportPrice: '',
  priceMode: 'value' as 'value' | 'last_purchase_pct' | 'cost_pct',
  priceCurrency: 'EGP',
  extraAssemblyCost: '',
  extraAssemblyCostPct: '',
  purchaseCount: '',
  minPurchaseQty: '',
  imageUrl: '',
  defaultWarehouseId: '',
  priceSource: 'price_list' as 'price_list' | 'item_card',
  purchasePrice: '',
};

export type ItemCardForm = typeof EMPTY_ITEM_FORM;

export function moneyToInput(value: number | string | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value);
}

export function optionalMoney(value: string): number | undefined {
  if (!value || !String(value).trim()) return undefined;
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function padRows<T>(rows: T[], empty: T, min = 3): T[] {
  const next = rows.slice();
  while (next.length < min) next.push({ ...empty });
  return next;
}

export function parseAssemblyRows(value: unknown): AssemblyRow[] {
  if (!Array.isArray(value)) return padRows([], EMPTY_ASSEMBLY_ROW);
  return padRows(
    value.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        itemName: String(r.itemName ?? ''),
        quantity: r.quantity == null ? '' : String(r.quantity),
        cost: r.cost == null ? '' : String(r.cost),
      };
    }),
    EMPTY_ASSEMBLY_ROW
  );
}

export function parseSupplierRows(value: unknown): SupplierRow[] {
  if (!Array.isArray(value)) return padRows([], EMPTY_SUPPLIER_ROW);
  return padRows(
    value.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        supplierName: String(r.supplierName ?? ''),
        price: r.price == null ? '' : String(r.price),
        leadTimeDays: r.leadTimeDays == null ? '' : String(r.leadTimeDays),
      };
    }),
    EMPTY_SUPPLIER_ROW
  );
}

export function compactAssemblyRows(rows: AssemblyRow[]) {
  return rows.filter((row) => row.itemName.trim() || row.quantity.trim() || row.cost.trim());
}

export function compactSupplierRows(rows: SupplierRow[]) {
  return rows.filter((row) => row.supplierName.trim() || row.price.trim() || row.leadTimeDays.trim());
}

export function assemblyRowsTotal(rows: AssemblyRow[]): number {
  return rows.reduce((sum, row) => {
    const qty = optionalMoney(row.quantity) ?? 0;
    const cost = optionalMoney(row.cost) ?? 0;
    return sum + qty * cost;
  }, 0);
}

export function applyItemToForm(item: Partial<ItemDetail>): ItemCardForm {
  const retail = moneyToInput(item.priceRetail ?? item.retailPrice);
  const mode = item.priceMode;
  return {
    ...EMPTY_ITEM_FORM,
    serial: item.serial ?? '',
    arabicName: item.arabicName ?? '',
    englishName: item.englishName ?? '',
    categoryId: item.categoryId ?? '',
    barcode: item.barcode ?? '',
    defaultTaxPercent: moneyToInput(item.defaultTaxPercent),
    mainAccountId: item.mainAccountId ?? '',
    costCenterId: item.costCenterId ?? '',
    specifications: item.specifications ?? '',
    weight: moneyToInput(item.weight),
    manufacturerId: item.manufacturerId ?? '',
    colorId: item.colorId ?? '',
    countryOfOrigin: item.countryOfOrigin ?? '',
    quality: item.quality ?? '',
    size: item.size ?? '',
    property1: item.property1 ?? '',
    property2: item.property2 ?? '',
    property3: item.property3 ?? '',
    property4: item.property4 ?? '',
    property5: item.property5 ?? '',
    orderLimit: moneyToInput(item.orderLimit),
    orderLimitPercentage: moneyToInput(item.orderLimitPercentage),
    upperLimit: moneyToInput(item.upperLimit),
    lowerLimit: moneyToInput(item.lowerLimit),
    beginningBalance: moneyToInput(item.beginningBalance),
    beginningCostPrice: moneyToInput(item.beginningCostPrice),
    priceRetail: retail,
    priceSemiWholesale: moneyToInput(item.priceSemiWholesale),
    priceWholesale: moneyToInput(item.priceWholesale),
    priceProjects: moneyToInput(item.priceProjects),
    isService: item.isService ?? false,
    isAssembly: item.isAssembly ?? false,
    isTaxExempt: item.isTaxExempt ?? false,
    consumerPrice: moneyToInput(item.consumerPrice),
    retailPrice: moneyToInput(item.retailPrice ?? item.priceRetail) || retail,
    representativePrice: moneyToInput(item.representativePrice),
    exportPrice: moneyToInput(item.exportPrice),
    useExpirationDate: item.useExpirationDate ?? false,
    inactiveItem: item.inactiveItem ?? false,
    notSubjectToTerms: item.notSubjectToTerms ?? false,
    cannotBeReturned: item.cannotBeReturned ?? false,
    noSellBelowCost: item.noSellBelowCost ?? false,
    useSerialNumber: item.useSerialNumber ?? false,
    clothingItem: item.clothingItem ?? false,
    priceMode:
      mode === 'last_purchase_pct' || mode === 'cost_pct' || mode === 'value' ? mode : 'value',
    priceCurrency: item.priceCurrency || 'EGP',
    extraAssemblyCost: moneyToInput(item.extraAssemblyCost),
    extraAssemblyCostPct: moneyToInput(item.extraAssemblyCostPct),
    purchaseCount: moneyToInput(item.purchaseCount),
    minPurchaseQty: moneyToInput(item.minPurchaseQty),
    imageUrl: item.imageUrl ?? '',
    defaultWarehouseId: item.defaultWarehouseId ?? '',
    priceSource: item.priceSource === 'item_card' ? 'item_card' : 'price_list',
    purchasePrice: moneyToInput(item.lastPurchasePrice),
  };
}
