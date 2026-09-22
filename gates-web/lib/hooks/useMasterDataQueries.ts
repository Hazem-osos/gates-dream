'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';

export type AccountOption = {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string | null;
  parentId?: string | null;
  accountType?: string | null;
  statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | null;
  accountKind?: 'HEADER' | 'POSTING' | null;
  costCenterRequired?: string | null;
  requiresCostCenter?: boolean | null;
  _count?: { children?: number };
};

export type WarehouseOption = {
  id: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
  parentWarehouseId?: string | null;
  warehouseKind?: 'HEADER' | 'POSTING' | null;
  _count?: { childWarehouses?: number };
};

export type ItemOption = {
  id: string;
  code?: string | null;
  serial?: string | null;
  barcode?: string | null;
  arabicName: string;
  englishName?: string | null;
  salesPrice?: number | null;
  averageCost?: number | string | null;
  onHandQuantity?: number | null;
  itemPrices?: {
    price?: number;
    retailPrice?: number | string | null;
    unitId?: string | null;
    priceList?: { id?: string; priceMode?: string | null; isActive?: boolean | null; isDefault?: boolean };
  }[];
  units?: {
    unitId?: string;
    isBaseUnit?: boolean;
    unit?: { id: string; code?: string | null; arabicName: string };
    conversionFactor?: number | string | null;
    isFactorFixed?: boolean | null;
  }[];
  defaultTaxPercent?: number | string | null;
  taxExemptionReason?: string | null;
  useExpirationDate?: boolean | null;
  useSerialNumber?: boolean | null;
  clothingItem?: boolean | null;
  defaultWarehouseId?: string | null;
  isAssembly?: boolean | null;
  priceSource?: string | null;
  lastPurchasePrice?: number | string | null;
  trackingType?: string | null;
  hasExpiry?: boolean | null;
  color?: string | null;
  size?: string | null;
  colorId?: string | null;
};

export type PartyOption = {
  id: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
  mobile?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  accountId?: string | null;
  priceListId?: string | null;
  priceTier?: string | null;
};

export type CostCenterOption = {
  id: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
  parentId?: string | null;
  costCenterKind?: 'HEADER' | 'POSTING' | null;
  children?: { id: string }[] | null;
  _count?: { children?: number };
};

export function formatAccountLabel(a: Pick<AccountOption, 'code' | 'arabicName'>) {
  return `[${a.code}] ${a.arabicName}`;
}

export function formatItemLabel(item: ItemOption) {
  const code = item.code || item.serial || item.id.slice(0, 8);
  let price: number | null = null;
  if (typeof item.salesPrice === 'number') price = item.salesPrice;
  else if (item.itemPrices?.length) {
    const def = item.itemPrices.find((p) => p.priceList?.isDefault) ?? item.itemPrices[0];
    if (def?.price != null) price = Number(def.price);
  }
  const baseUnit = item.units?.find((u) => u.isBaseUnit) ?? item.units?.[0];
  const unitSuffix = baseUnit?.unit
    ? ` · ${baseUnit.unit.code || baseUnit.unit.arabicName}`
    : '';
  const priceSuffix = price != null && price > 0 ? ` — ${price.toFixed(2)}` : '';
  return `[${code}] ${item.arabicName}${unitSuffix}${priceSuffix}`;
}

function unwrapMasterRows<T>(data: unknown, nestedKeys: string[] = []): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of [...nestedKeys, 'data']) {
      const nested = record[key];
      if (Array.isArray(nested)) return nested as T[];
    }
  }
  return [];
}

/** First page for searchable pickers — never download the whole master list. */
export const PICKER_PAGE_SIZE = 30;
const PICKER_SEARCH_DEBOUNCE_MS = 300;

function pickerParams(search: string | undefined, limit: number, extra?: Record<string, string | number | boolean>) {
  const params: Record<string, string | number | boolean> = {
    limit,
    isActive: true,
    ...extra,
  };
  const q = search?.trim() ?? '';
  if (q.length >= 1) params.search = q;
  return params;
}

export function isPostableLeafAccount(account: AccountOption): boolean {
  if (account.accountKind === 'HEADER') return false;
  if ((account._count?.children ?? 0) > 0) return false;
  return account.accountKind === 'POSTING' || (account._count?.children ?? 0) === 0;
}

/** Account/safe dropdowns must load the full posting list, not a first page. */
export const ACCOUNT_PICKER_PAGE_SIZE = 20_000;
export const PICKER_UNLIMITED_VISIBLE = Number.POSITIVE_INFINITY;

export function useAccountsQuery(
  search?: string,
  limit = ACCOUNT_PICKER_PAGE_SIZE,
  opts?: {
    leafOnly?: boolean;
    headerOnly?: boolean;
    statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT';
    enabled?: boolean;
  }
) {
  const debounced = useDebouncedValue(search ?? '', PICKER_SEARCH_DEBOUNCE_MS);
  const extra: Record<string, string | number | boolean> = {};
  if (opts?.leafOnly) extra.leafOnly = 'true';
  if (opts?.headerOnly) extra.headerOnly = 'true';
  if (opts?.statementType) extra.statementType = opts.statementType;
  const params = pickerParams(debounced, limit, extra);

  return useApiQuery<AccountOption[]>(
    queryKeys.accounts(params),
    '/accounting/accounts',
    params,
    {
      staleTime: 15_000,
      gcTime: staleTimes.masterGcMs,
      refetchOnMount: 'always',
      enabled: opts?.enabled !== false,
    }
  );
}

export function isHeaderWarehouse(warehouse: WarehouseOption): boolean {
  const childCount = warehouse._count?.childWarehouses ?? 0;
  if (childCount > 0) return true;
  if (warehouse.warehouseKind === 'POSTING') return false;
  return false;
}

export function isOperationsWarehouse(warehouse: WarehouseOption): boolean {
  return !isHeaderWarehouse(warehouse);
}

export function useWarehousesQuery(
  limit = 200,
  opts?: { leafOnly?: boolean; headerOnly?: boolean; enabled?: boolean }
) {
  const extra: Record<string, string | number | boolean> = { limit, isActive: true };
  if (opts?.leafOnly) extra.leafOnly = 'true';
  if (opts?.headerOnly) extra.headerOnly = 'true';
  const query = useApiQuery<WarehouseOption[]>(
    queryKeys.warehouses(extra),
    '/inventory/warehouses',
    extra,
    {
      staleTime: staleTimes.masterMs,
      gcTime: staleTimes.masterGcMs,
      enabled: opts?.enabled !== false,
    }
  );
  const rows = unwrapMasterRows<WarehouseOption>(query.data?.data, ['warehouses', 'items']);
  const data = query.data ? { ...query.data, data: rows } : query.data;
  return { ...query, data };
}

export function useItemsQuery(
  limit = 200,
  search?: string,
  extra?: Record<string, string | number | boolean>
) {
  const debounced = useDebouncedValue(search ?? '', PICKER_SEARCH_DEBOUNCE_MS);
  const params = pickerParams(debounced, limit, extra);
  const query = useApiQuery<ItemOption[]>(
    queryKeys.items(params),
    '/inventory/items',
    params,
    { staleTime: staleTimes.masterMs, gcTime: staleTimes.masterGcMs }
  );
  const rows = unwrapMasterRows<ItemOption>(query.data?.data, ['items']);
  const data = query.data ? { ...query.data, data: rows } : query.data;
  return { ...query, data };
}

export function useCustomersQuery(limit = 200, search?: string, enabled = true) {
  const debounced = useDebouncedValue(search ?? '', PICKER_SEARCH_DEBOUNCE_MS);
  const params = pickerParams(debounced, limit);
  return useApiQuery<PartyOption[]>(
    ['customers', params],
    '/accounting/customers',
    params,
    { staleTime: staleTimes.masterMs, gcTime: staleTimes.masterGcMs, enabled }
  );
}

export function useSuppliersQuery(limit = 200, search?: string, enabled = true) {
  const debounced = useDebouncedValue(search ?? '', PICKER_SEARCH_DEBOUNCE_MS);
  const params = pickerParams(debounced, limit);
  return useApiQuery<PartyOption[]>(
    ['suppliers', params],
    '/accounting/suppliers',
    params,
    { staleTime: staleTimes.masterMs, gcTime: staleTimes.masterGcMs, enabled }
  );
}

export function isPostableLeafCostCenter(center: CostCenterOption): boolean {
  if (center.costCenterKind === 'HEADER') return false;
  if ((center._count?.children ?? 0) > 0) return false;
  if (Array.isArray(center.children) && center.children.length > 0) return false;
  return center.costCenterKind === 'POSTING' || center.costCenterKind == null;
}

export function useCostCentersQuery(
  limit = 200,
  opts?: { leafOnly?: boolean; headerOnly?: boolean; enabled?: boolean }
) {
  const extra: Record<string, string | number | boolean> = { limit, isActive: true };
  if (opts?.leafOnly) extra.leafOnly = 'true';
  if (opts?.headerOnly) extra.headerOnly = 'true';
  return useApiQuery<CostCenterOption[]>(
    ['cost-centers', extra],
    '/accounting/cost-centers',
    extra,
    {
      staleTime: staleTimes.masterMs,
      gcTime: staleTimes.masterGcMs,
      enabled: opts?.enabled !== false,
    }
  );
}

export function useCurrenciesQuery(limit = 100) {
  return useApiQuery<
    { id: string; code: string; arabicName: string; englishName?: string; exchangeRate?: number | string | null }[]
  >(
    queryKeys.currencies,
    '/accounting/currencies',
    { limit, isActive: true },
    { staleTime: staleTimes.masterMs, gcTime: staleTimes.masterGcMs }
  );
}

export type SafeOption = {
  id: string;
  arabicName?: string;
  englishName?: string | null;
  code?: string | null;
  balance?: number | string;
  isDefault?: boolean;
  glAccountCode?: string | null;
  glAccount?: { id?: string; code?: string | null; arabicName?: string } | null;
};

export function pickDefaultSafeId<T extends { id: string; isDefault?: boolean }>(
  safes: T[] | undefined | null
): string | undefined {
  if (!safes?.length) return undefined;
  return safes.find((safe) => safe.isDefault)?.id ?? safes[0]?.id;
}

export function useSafesQuery(params?: { isActive?: boolean; enabled?: boolean }) {
  const queryParams = { isActive: params?.isActive ?? true };
  return useApiQuery<SafeOption[]>(
    queryKeys.safes(queryParams),
    '/accounting/safes',
    queryParams,
    {
      staleTime: 0,
      gcTime: staleTimes.masterGcMs,
      refetchOnMount: 'always',
      enabled: params?.enabled !== false,
    }
  );
}

export type BankAccountOption = {
  id: string;
  arabicName?: string;
  englishName?: string | null;
  code?: string | null;
  accountNumber?: string | null;
  balance?: number | string;
  isDefault?: boolean;
  glAccountCode?: string | null;
  glAccount?: { id?: string; code?: string | null; arabicName?: string } | null;
  bank?: { arabicName?: string; englishName?: string; code?: string | null } | null;
};

export function useBankAccountsQuery(params?: { isActive?: boolean; enabled?: boolean }) {
  const queryParams = { isActive: params?.isActive ?? true };
  return useApiQuery<BankAccountOption[]>(
    queryKeys.bankAccounts(queryParams),
    '/accounting/bank-accounts',
    queryParams,
    {
      staleTime: 0,
      gcTime: staleTimes.masterGcMs,
      refetchOnMount: 'always',
      enabled: params?.enabled !== false,
    }
  );
}

export type LiveFundBalance = { id: string; balance?: number | string | null };

/** Always reads the current safe/bank balance from the database. */
export function useLiveFundBalance(params: {
  kind: 'safe' | 'bank';
  id?: string | null;
  enabled?: boolean;
}) {
  const id = params.id ?? '';
  const enabled = Boolean(id) && params.enabled !== false;
  return useApiQuery<LiveFundBalance>(
    params.kind === 'safe' ? ['safe-live-balance', id] : ['bank-live-balance', id],
    params.kind === 'safe' ? `/accounting/safes/${id}` : `/accounting/bank-accounts/${id}`,
    undefined,
    {
      enabled,
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
    }
  );
}

export function invalidateTreasuryFundBalances(invalidate: (key: readonly unknown[]) => void) {
  invalidate(['safes']);
  invalidate(['bank-accounts']);
  invalidate(['safe-live-balance']);
  invalidate(['bank-live-balance']);
}

export function useBranchesQuery(limit = 50) {
  return useApiQuery<{ id: string; arabicName?: string; name?: string; isActive?: boolean }[]>(
    queryKeys.branches({ limit }),
    '/company/branches',
    { page: 1, limit },
    { staleTime: staleTimes.masterMs, gcTime: staleTimes.masterGcMs }
  );
}

export function useTaxRulesQuery(limit = 100) {
  return useApiQuery<{ id: string; arabicName?: string; name?: string; rate?: number }[]>(
    queryKeys.taxRules({ limit }),
    '/accounting/tax-rules',
    { limit, isActive: true },
    { staleTime: staleTimes.masterMs, gcTime: staleTimes.masterGcMs, retry: 1 }
  );
}

export function useCoaHierarchyQuery() {
  return useApiQuery<unknown[]>(
    ['coa-tree'],
    '/accounting/accounts/hierarchy',
    undefined,
    { staleTime: 0, gcTime: staleTimes.masterGcMs, refetchOnMount: 'always' }
  );
}
