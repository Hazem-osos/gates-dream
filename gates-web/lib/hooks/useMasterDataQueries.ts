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
  _count?: { children?: number };
};

export type WarehouseOption = {
  id: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
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
  itemPrices?: { price?: number; priceList?: { isDefault?: boolean } }[];
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
};

export type CostCenterOption = {
  id: string;
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
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
  return (account._count?.children ?? 0) === 0;
}

export function useAccountsQuery(
  search?: string,
  limit = 200,
  opts?: { leafOnly?: boolean; statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT'; enabled?: boolean }
) {
  const debounced = useDebouncedValue(search ?? '', PICKER_SEARCH_DEBOUNCE_MS);
  const extra: Record<string, string | number | boolean> = {};
  if (opts?.leafOnly) extra.leafOnly = 'true';
  if (opts?.statementType) extra.statementType = opts.statementType;
  const params = pickerParams(debounced, limit, extra);

  return useApiQuery<AccountOption[]>(
    queryKeys.accounts(params),
    '/accounting/accounts',
    params,
    {
      staleTime: staleTimes.masterMs,
      gcTime: staleTimes.masterGcMs,
      enabled: opts?.enabled !== false,
    }
  );
}

export function useWarehousesQuery(limit = 200) {
  return useApiQuery<WarehouseOption[]>(
    queryKeys.warehouses({ limit, isActive: true }),
    '/inventory/warehouses',
    { limit, isActive: true },
    { staleTime: staleTimes.masterMs, gcTime: staleTimes.masterGcMs }
  );
}

export function useItemsQuery(limit = 200, search?: string) {
  const debounced = useDebouncedValue(search ?? '', PICKER_SEARCH_DEBOUNCE_MS);
  const params = pickerParams(debounced, limit);
  return useApiQuery<ItemOption[]>(
    queryKeys.items(params),
    '/inventory/items',
    params,
    { staleTime: staleTimes.masterMs, gcTime: staleTimes.masterGcMs }
  );
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

export function useCostCentersQuery(limit = 200) {
  return useApiQuery<CostCenterOption[]>(
    ['cost-centers', { limit, isActive: true }],
    '/accounting/cost-centers',
    { limit, isActive: true },
    { staleTime: staleTimes.masterMs, gcTime: staleTimes.masterGcMs }
  );
}

export function useCurrenciesQuery(limit = 100) {
  return useApiQuery<
    { id: string; code: string; arabicName: string; englishName?: string }[]
  >(
    queryKeys.currencies,
    '/accounting/currencies',
    { limit, isActive: true },
    { staleTime: staleTimes.masterMs, gcTime: staleTimes.masterGcMs }
  );
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
    { staleTime: staleTimes.masterMs, gcTime: staleTimes.masterGcMs }
  );
}
