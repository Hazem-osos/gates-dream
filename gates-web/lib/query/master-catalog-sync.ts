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
  'price-lists',
  'report-filter-currencies',
  'report-filter-delegates',
  'report-filter-branches',
  'report-filter-item-groups',
  'report-filter-price-lists',
] as const;

const KEYS_BY_KIND: Record<string, readonly (readonly unknown[])[]> = {
  account: [['accounts'], ['coa-tree'], ['chart-of-accounts']],
  accounts: [['accounts'], ['coa-tree'], ['chart-of-accounts']],
  customer: [['customers'], ['accounts'], ['chart-of-accounts'], ['coa-tree']],
  customers: [['customers'], ['accounts'], ['chart-of-accounts'], ['coa-tree']],
  supplier: [['suppliers'], ['accounts'], ['chart-of-accounts'], ['coa-tree']],
  suppliers: [['suppliers'], ['accounts'], ['chart-of-accounts'], ['coa-tree']],
  'cost-center': [['cost-centers']],
  'cost-centers': [['cost-centers']],
  item: [['items'], ['item-categories']],
  items: [['items'], ['item-categories']],
  'item-categories': [['item-categories'], ['report-filter-item-groups']],
  warehouse: [['warehouses']],
  warehouses: [['warehouses']],
  unit: [['units']],
  units: [['units']],
  safe: [['safes']],
  safes: [['safes']],
  'bank-account': [['bank-accounts'], ['banks']],
  'bank-accounts': [['bank-accounts'], ['banks']],
  banks: [['banks'], ['bank-accounts']],
  currencies: [['currencies'], ['report-filter-currencies']],
  delegates: [['delegates'], ['report-filter-delegates']],
  'company-branches': [['company-branches'], ['report-filter-branches']],
  'price-lists': [['price-lists'], ['report-filter-price-lists']],
  invoices: [['invoices']],
  'journal-entries': [['journal-entries']],
};

/** API path (no query) → catalog kind, so a save refreshes every open list of that kind. */
const MUTATION_KINDS: { prefix: string; kind: string }[] = [
  { prefix: '/accounting/currencies', kind: 'currencies' },
  { prefix: '/accounting/customers', kind: 'customers' },
  { prefix: '/accounting/suppliers', kind: 'suppliers' },
  { prefix: '/accounting/cost-centers', kind: 'cost-centers' },
  { prefix: '/accounting/accounts', kind: 'accounts' },
  { prefix: '/accounting/chart-of-accounts', kind: 'accounts' },
  { prefix: '/accounting/safes', kind: 'safes' },
  { prefix: '/accounting/bank-accounts', kind: 'bank-accounts' },
  { prefix: '/accounting/banks', kind: 'banks' },
  { prefix: '/accounting/delegates', kind: 'delegates' },
  { prefix: '/inventory/items', kind: 'items' },
  { prefix: '/inventory/item-categories', kind: 'item-categories' },
  { prefix: '/inventory/warehouses', kind: 'warehouses' },
  { prefix: '/inventory/units', kind: 'units' },
  { prefix: '/inventory/price-lists', kind: 'price-lists' },
  { prefix: '/company/branches', kind: 'company-branches' },
  { prefix: '/settings/branches', kind: 'company-branches' },
  { prefix: '/invoices', kind: 'invoices' },
  { prefix: '/accounting/journal-entries', kind: 'journal-entries' },
];

export function masterKindForMutation(url: string): string | null {
  const path = url.split('?')[0] ?? url;
  const hit = MUTATION_KINDS.find(
    (rule) => path === rule.prefix || path.startsWith(`${rule.prefix}/`)
  );
  return hit?.kind ?? null;
}

let generation = 0;
let refreshWave = 0;

export function masterCatalogGeneration() {
  return generation;
}

export function isMasterCatalogKey(queryKey: readonly unknown[]) {
  const head = queryKey[0];
  return typeof head === 'string' && MASTER_CATALOG_PREFIXES.includes(head as (typeof MASTER_CATALOG_PREFIXES)[number]);
}

const DOCUMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

/** A single open document. Refetching it mid-edit would wipe the form. */
export function isOpenDocumentQueryKey(queryKey: readonly unknown[]) {
  return queryKey.some((part) => typeof part === 'string' && DOCUMENT_ID.test(part));
}

export type CatalogWriteDetail = {
  generation: number;
  kind?: string;
  method?: string;
  row?: Record<string, unknown>;
};

const ROW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

/** Saved entity from a mutation body, or the id on a DELETE url. */
export function catalogWriteFromResponse(
  url: string,
  method: string,
  parsed: unknown
): { method: string; row?: Record<string, unknown> } {
  const data =
    parsed && typeof parsed === 'object' && 'data' in parsed
      ? (parsed as { data?: unknown }).data
      : undefined;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const row = data as Record<string, unknown>;
    if (typeof row.id === 'string' && row.id) return { method, row };
  }
  if (method === 'DELETE') {
    const last = url.split('?')[0]?.split('/').filter(Boolean).pop();
    if (last && ROW_ID.test(last)) return { method, row: { id: last } };
  }
  return { method };
}

function listCacheKey(queryKey: readonly unknown[]) {
  if (isOpenDocumentQueryKey(queryKey)) return false;
  for (const part of queryKey) {
    if (typeof part !== 'string') continue;
    if (/serial|next-number|next-code|cost-as-of|stock-balance|badge/i.test(part)) return false;
  }
  return true;
}

/** Puts the row that was just saved into every open list of that kind. */
export function rememberCatalogRow(
  queryClient: QueryClient,
  kind: string | undefined,
  row: Record<string, unknown> | undefined,
  method?: string
) {
  if (!kind || !row || typeof row.id !== 'string' || !row.id) return;
  const keys = KEYS_BY_KIND[kind];
  if (!keys) return;
  const nextRow: Record<string, unknown> = { ...row };
  if ((kind === 'items' || kind === 'item') && nextRow.code == null && typeof nextRow.serial === 'string') {
    nextRow.code = nextRow.serial;
  }
  if ((kind === 'items' || kind === 'item') && nextRow.isActive == null) {
    nextRow.isActive = true;
  }
  for (const key of keys) {
    const cached = queryClient.getQueriesData<unknown>({ queryKey: [...key] });
    for (const [queryKey, old] of cached) {
      if (!listCacheKey(queryKey)) continue;
      if (!old || typeof old !== 'object' || !('data' in old) || !Array.isArray(old.data)) continue;
      const data = old.data as Array<Record<string, unknown> | null>;
      if (method === 'DELETE') {
        queryClient.setQueryData(queryKey, {
          ...old,
          data: data.filter((item) => !item || item.id !== row.id),
        });
        continue;
      }
      const index = data.findIndex((item) => item && item.id === row.id);
      const next =
        index >= 0
          ? data.map((item, i) => (i === index && item ? { ...item, ...nextRow } : item))
          : [...data, nextRow];
      queryClient.setQueryData(queryKey, { ...old, data: next });
    }
  }
}

export function bumpMasterCatalog(
  kind?: string,
  write?: { method?: string; row?: Record<string, unknown> }
) {
  generation += 1;
  clearConditionalGetCache();
  if (typeof window === 'undefined') return generation;
  const detail: CatalogWriteDetail = {
    generation,
    kind,
    method: write?.method,
    row: write?.row,
  };
  window.dispatchEvent(new CustomEvent(MASTER_CATALOG_EVENT, { detail }));
  return generation;
}

/**
 * After any save: drop in-flight GETs (they can still be the pre-save list),
 * refetch every open list and next-serial, and mark everything else stale
 * so the next screen opens on current data.
 */
export function refreshAfterWrite(queryClient: QueryClient, detail?: CatalogWriteDetail) {
  const wave = ++refreshWave;
  clearConditionalGetCache();
  rememberCatalogRow(queryClient, detail?.kind, detail?.row, detail?.method);
  const isList = (query: { queryKey: readonly unknown[] }) =>
    !isOpenDocumentQueryKey(query.queryKey);
  void (async () => {
    await queryClient.cancelQueries({ predicate: isList });
    if (wave !== refreshWave) return;
    await queryClient.invalidateQueries({ predicate: isList, refetchType: 'all' });
    if (wave !== refreshWave) return;
    await queryClient.invalidateQueries({
      predicate: (query) => isOpenDocumentQueryKey(query.queryKey),
      refetchType: 'none',
    });
  })();
}

export function invalidateMasterCatalog(
  queryClient: QueryClient,
  kind?: QuickCreateKind | string
) {
  clearConditionalGetCache();
  const keys = kind && kind in KEYS_BY_KIND
    ? KEYS_BY_KIND[kind]
    : MASTER_CATALOG_PREFIXES.map((prefix) => [prefix] as const);
  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: key, refetchType: 'all' });
  }
}
