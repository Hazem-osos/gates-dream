import { cachePolicies } from '@/lib/query/cache-policies';
import type { PrefetchApiQueryDef } from '@/lib/query/prefetch-api-query';
import { queryKeys } from '@/lib/query/query-keys';

const master = cachePolicies.master.staleTime;
const txn = cachePolicies.transactional.staleTime;

const masterCustomers: PrefetchApiQueryDef = {
  key: ['customers', { limit: 30, isActive: true }],
  url: '/accounting/customers',
  params: { limit: 30, isActive: true },
  staleTime: master,
  gcTime: cachePolicies.master.gcTime,
};

const masterSuppliers: PrefetchApiQueryDef = {
  key: ['suppliers', { limit: 30, isActive: true }],
  url: '/accounting/suppliers',
  params: { limit: 30, isActive: true },
  staleTime: master,
  gcTime: cachePolicies.master.gcTime,
};

const masterItems200: PrefetchApiQueryDef = {
  key: queryKeys.items({ limit: 200, isActive: true }),
  url: '/inventory/items',
  params: { limit: 200, isActive: true },
  staleTime: master,
  gcTime: cachePolicies.master.gcTime,
};

const masterItemsPicker: PrefetchApiQueryDef = {
  key: queryKeys.items({ limit: 30, isActive: true }),
  url: '/inventory/items',
  params: { limit: 30, isActive: true },
  staleTime: master,
  gcTime: cachePolicies.master.gcTime,
};

const masterWarehouses: PrefetchApiQueryDef = {
  key: queryKeys.warehouses({ limit: 200, isActive: true }),
  url: '/inventory/warehouses',
  params: { limit: 200, isActive: true },
  staleTime: master,
  gcTime: cachePolicies.master.gcTime,
};

const masterCoaTree: PrefetchApiQueryDef = {
  key: ['coa-tree'],
  url: '/accounting/accounts/hierarchy',
  staleTime: master,
  gcTime: cachePolicies.master.gcTime,
};

const masterAccounts: PrefetchApiQueryDef = {
  key: queryKeys.accounts({ limit: 30, isActive: true }),
  url: '/accounting/accounts',
  params: { limit: 30, isActive: true },
  staleTime: master,
  gcTime: cachePolicies.master.gcTime,
};

const masterBranches: PrefetchApiQueryDef = {
  key: queryKeys.branches({ limit: 50 }),
  url: '/company/branches',
  params: { page: 1, limit: 50 },
  staleTime: master,
  gcTime: cachePolicies.master.gcTime,
};

const masterCostCenters: PrefetchApiQueryDef = {
  key: ['cost-centers', { limit: 200, isActive: true }],
  url: '/accounting/cost-centers',
  params: { limit: 200, isActive: true },
  staleTime: master,
  gcTime: cachePolicies.master.gcTime,
};

const masterCurrencies: PrefetchApiQueryDef = {
  key: queryKeys.currencies,
  url: '/accounting/currencies',
  params: { limit: 100, isActive: true },
  staleTime: master,
  gcTime: cachePolicies.master.gcTime,
};

const journalListPage1: PrefetchApiQueryDef = {
  key: queryKeys.journalEntries(1, {
    postedFilter: 'all',
    search: '',
    startDate: '',
    endDate: '',
  }),
  url: '/accounting/journal-entries',
  params: { page: 1, limit: 10, includeLines: false },
  staleTime: txn,
  gcTime: cachePolicies.transactional.gcTime,
};

const salesInvoicesList: PrefetchApiQueryDef = {
  key: queryKeys.invoices({
    page: 1,
    invoiceKind: 'SALE',
    search: '',
    postedFilter: 'all',
    startDate: '',
    endDate: '',
  }),
  url: '/invoices',
  params: { page: 1, limit: 10, invoiceKind: 'SALE' },
  staleTime: txn,
  gcTime: cachePolicies.transactional.gcTime,
};

type RoutePrefetchRule = {
  prefix: string;
  queries: PrefetchApiQueryDef[];
};

/** Longest-prefix wins when resolving hover prefetch for an href. */
export const ROUTE_PREFETCH_RULES: RoutePrefetchRule[] = [
  {
    prefix: '/inventory/operations/sales-invoice',
    queries: [
      masterCustomers,
      masterItemsPicker,
      masterWarehouses,
      masterCostCenters,
      masterCurrencies,
      salesInvoicesList,
    ],
  },
  {
    prefix: '/inventory/operations/final-purchase-invoice',
    queries: [masterSuppliers, masterItemsPicker, masterWarehouses, masterCostCenters],
  },
  {
    prefix: '/inventory/operations/purchase-order',
    queries: [masterSuppliers, masterItemsPicker, masterWarehouses, masterCostCenters],
  },
  {
    prefix: '/accounting/operations/journal-entry',
    queries: [journalListPage1, masterAccounts, masterCoaTree],
  },
  {
    prefix: '/accounting/chart-of-accounts',
    queries: [masterCoaTree, masterAccounts],
  },
  {
    prefix: '/accounting/account-reports/books',
    queries: [masterCoaTree, masterAccounts],
  },
  {
    prefix: '/inventory',
    queries: [masterItems200, masterWarehouses],
  },
  {
    prefix: '/accounting',
    queries: [masterCoaTree, masterAccounts, masterCustomers, masterCurrencies, masterBranches],
  },
  {
    prefix: '/pos',
    queries: [masterItems200, masterCustomers],
  },
];

export function prefetchQueriesForHref(href: string): PrefetchApiQueryDef[] {
  const path = href.split('?')[0]?.split('#')[0] ?? href;
  if (!path.startsWith('/')) return [];

  let best: RoutePrefetchRule | null = null;
  for (const rule of ROUTE_PREFETCH_RULES) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      if (!best || rule.prefix.length > best.prefix.length) {
        best = rule;
      }
    }
  }
  return best?.queries ?? [];
}
