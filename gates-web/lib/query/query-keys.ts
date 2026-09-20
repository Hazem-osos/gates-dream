/**
 * Central React Query keys — use these instead of ad-hoc string arrays.
 */
export const queryKeys = {
  userMe: ['user-me'] as const,
  accounts: (params?: Record<string, unknown>) => ['accounts', params ?? {}] as const,
  warehouses: (params?: Record<string, unknown>) => ['warehouses', params ?? {}] as const,
  itemCategories: (params?: Record<string, unknown>) => ['item-categories', params ?? {}] as const,
  otherAdditionDiscountTypes: (params?: Record<string, unknown>) =>
    ['other-addition-discount-types', params ?? {}] as const,
  representativeCommissionQuantities: (params?: Record<string, unknown>) =>
    ['representatives-commissions-quantities', params ?? {}] as const,
  representativeCommissionValues: (params?: Record<string, unknown>) =>
    ['representatives-commissions-values', params ?? {}] as const,
  representativeCommissionPolicies: (params?: Record<string, unknown>) =>
    ['representatives-commissions-policy', params ?? {}] as const,
  priceLists: (params?: Record<string, unknown>) => ['price-lists', params ?? {}] as const,
  priceListDetail: (id: string) => ['price-list', id] as const,
  itemOrderLimits: (params?: Record<string, unknown>) =>
    ['item-order-limits', params ?? {}] as const,
  customerContracts: (params?: Record<string, unknown>) =>
    ['customer-contracts', params ?? {}] as const,
  clothingColors: () => ['clothing-colors'] as const,
  clothingSizes: () => ['clothing-sizes'] as const,
  clothingCombos: () => ['clothing-combos'] as const,
  currencies: ['currencies'] as const,
  safes: (params?: Record<string, unknown>) => ['safes', params ?? {}] as const,
  bankAccounts: (params?: Record<string, unknown>) => ['bank-accounts', params ?? {}] as const,
  branches: (params?: Record<string, unknown>) => ['company-branches', params ?? {}] as const,
  taxRules: (params?: Record<string, unknown>) => ['tax-rules', params ?? {}] as const,
  journalEntries: (page: number, filters?: Record<string, unknown>) =>
    ['journal-entries', String(page), filters ?? {}] as const,
  invoices: (params?: Record<string, unknown>) => ['invoices', params ?? {}] as const,
  invoiceBadges: ['invoice-badges'] as const,
  invoiceDetail: (id: string) => ['invoice', id] as const,
  journalEntryDetail: (id: string) => ['journal-entry', id] as const,
  items: (params?: Record<string, unknown>) => ['items', params ?? {}] as const,
  units: (params?: Record<string, unknown>) => ['units', params ?? {}] as const,
  backendHealth: ['backend-health'] as const,
  sentinelAlerts: () => ['sentinel-alerts'] as const,
  subcontracts: {
    all: ['subcontracts'] as const,
    dashboard: () => ['subcontracts', 'dashboard'] as const,
    list: () => ['subcontracts', 'list'] as const,
    detail: (id: string) => ['subcontracts', 'detail', id] as const,
    directory: () => ['subcontracts', 'directory'] as const,
    projects: () => ['subcontracts', 'contracting-projects'] as const,
    form41: (year: number, quarter: number) => ['subcontracts', 'form41', year, quarter] as const,
  },
  contracting: {
    all: ['contracting'] as const,
    dashboard: () => ['contracting', 'dashboard'] as const,
    projects: () => ['contracting', 'projects'] as const,
    project: (id: string) => ['contracting', 'project', id] as const,
    ownerBoq: (projectId: string) => ['contracting', 'owner-boq', projectId] as const,
    measurements: (boqItemId: string) => ['contracting', 'measurements', boqItemId] as const,
    clientContract: (projectId: string) => ['contracting', 'client-contract', projectId] as const,
    siteStock: (projectId: string) => ['contracting', 'site-stock', projectId] as const,
    lettersOfGuarantee: (projectId: string) => ['contracting', 'lg', projectId] as const,
    evm: (projectId: string) => ['contracting', 'evm', projectId] as const,
    budgetVsActual: (projectId: string) => ['contracting', 'budget-vs-actual', projectId] as const,
  },
  attachments: {
    list: (filters: Record<string, unknown>) => ['attachments', filters] as const,
  },
  realEstate: {
    all: ['real-estate'] as const,
    dashboard: () => ['real-estate', 'dashboard'] as const,
    investmentDashboard: () => ['real-estate', 'investment-dashboard'] as const,
    contracts: () => ['real-estate', 'contracts'] as const,
    contract: (id: string) => ['real-estate', 'contract', id] as const,
    cheques: () => ['real-estate', 'cheques'] as const,
    resale: () => ['real-estate', 'resale'] as const,
    rentalPools: () => ['real-estate', 'rental-pools'] as const,
  },
  extracts: {
    all: ['extracts'] as const,
    dashboard: () => ['extracts', 'dashboard'] as const,
  },
  electronicInvoices: {
    all: ['electronic-invoices'] as const,
    dashboard: () => ['electronic-invoices', 'dashboard'] as const,
  },
  automation: {
    all: ['automation'] as const,
    rules: (params?: Record<string, unknown>) => ['automation', 'rules', params ?? {}] as const,
    rule: (id: string) => ['automation', 'rule', id] as const,
    runs: (params?: Record<string, unknown>) => ['automation', 'runs', params ?? {}] as const,
    run: (id: string) => ['automation', 'run', id] as const,
  },
  ai: {
    all: ['ai'] as const,
    conversations: () => ['ai', 'conversations'] as const,
    conversation: (id: string) => ['ai', 'conversation', id] as const,
    actions: (conversationId: string) => ['ai', 'actions', conversationId] as const,
    insights: () => ['ai', 'insights'] as const,
    sentinelReport: () => ['ai', 'sentinel', 'executive-report'] as const,
    diagnosticReport: () => ['ai', 'diagnostic', 'report'] as const,
    academyStatus: (slug: string) => ['ai', 'academy', 'status', slug] as const,
    academyTour: (slug: string) => ['ai', 'academy', 'tour', slug] as const,
  },
};

export const staleTimes = {
  /** Master / reference data (COA, parties, warehouses, catalog). */
  masterMs: 10 * 60_000,
  masterGcMs: 30 * 60_000,
  /** Transactional lists (invoices, journals, stock logs). */
  transactionalMs: 30_000,
  transactionalGcMs: 10 * 60_000,
  /** @deprecated use masterMs */
  metadataMs: 10 * 60_000,
  /** @deprecated use transactionalMs */
  listMs: 30_000,
  profileMs: 5 * 60_000,
};
