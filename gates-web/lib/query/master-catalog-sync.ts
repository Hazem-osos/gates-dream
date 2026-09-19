import type { QueryClient } from '@tanstack/react-query';
import { clearConditionalGetCache } from '@/lib/api/conditional-get-cache';
import type { QuickCreateKind } from '@/lib/quick-create/catalog';

export const MASTER_CATALOG_EVENT = 'gates:master-catalog-changed';

export const MASTER_CATALOG_PREFIXES = [
  'accounts',
  'coa-tree',
  'chart-of-accounts',
  'warehouses',
  'units',
  'items',
  'item-categories',
  'customers',
  'suppliers',
  'cost-centers',
  'currencies',
  'safes',
  'bank-accounts',
  'banks',
  'delegates',
  'company-branches',
] as const;

const KEYS_BY_KIND: Record<QuickCreateKind, readonly (readonly unknown[])[]> = {
  account: [['accounts'], ['coa-tree'], ['chart-of-accounts']],
  customer: [['customers'], ['accounts'], ['chart-of-accounts'], ['coa-tree']],
  supplier: [['suppliers'], ['accounts'], ['chart-of-accounts'], ['coa-tree']],
  'cost-center': [['cost-centers']],
  item: [['items'], ['item-categories']],
  warehouse: [['warehouses']],
  safe: [['safes']],
  'bank-account': [['bank-accounts'], ['banks']],
};

let generation = 0;

export function masterCatalogGeneration() {
  return generation;
}

export function isMasterCatalogKey(queryKey: readonly unknown[]) {
  const head = queryKey[0];
  return typeof head === 'string' && MASTER_CATALOG_PREFIXES.includes(head as (typeof MASTER_CATALOG_PREFIXES)[number]);
}

export function bumpMasterCatalog(kind?: string) {
  generation += 1;
  clearConditionalGetCache();
  if (typeof window === 'undefined') return generation;
  window.dispatchEvent(
    new CustomEvent(MASTER_CATALOG_EVENT, { detail: { generation, kind } })
  );
  return generation;
}

export function invalidateMasterCatalog(
  queryClient: QueryClient,
  kind?: QuickCreateKind | string
) {
  clearConditionalGetCache();
  const keys = kind && kind in KEYS_BY_KIND
    ? KEYS_BY_KIND[kind as QuickCreateKind]
    : MASTER_CATALOG_PREFIXES.map((prefix) => [prefix] as const);
  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: key, refetchType: 'all' });
  }
}
