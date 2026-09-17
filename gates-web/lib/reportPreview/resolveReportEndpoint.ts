/**
 * Maps Next.js app route segments (…/preview parent folder chain) to GET /api/v1 paths.
 * Used by generic report preview pages. Returns null when no backend route exists.
 */
import { getReportByRegistryPath } from '@/lib/reports/reportCatalog';

const M16_REPORT_PATHS: Record<string, string> = {
  'balances/review-balance': 'trial-balance',
  'books/review-balance': 'trial-balance',
  'balances/monthly-review-balance': 'trial-balance',
  'analysis/income-statement': 'income-statement',
  // M16 (Item 35): "profit-loss" is the same statement as "income-statement"
  // in the catalog (duplicate templates). Routing it to the legacy
  // `/accounting/reports/profit-loss` endpoint hit a hard crash there
  // (`reportsService.getProfitAndLoss` filters `accountType` as a relation
  // on a scalar column). Point it at the same working M16 endpoint instead
  // of fixing dead-end legacy duplicate logic.
  'analysis/profit-loss': 'income-statement',
  'credit/financial-position-statement': 'balance-sheet',
  'moves/cash-flow': 'cash-flow',
  'credit/aged-receivables': 'aged-receivables',
  'credit/aged-payables': 'aged-payables',
  'balances/accounts-balance': 'trial-balance',
};

const LEGACY_ACCOUNT_REPORT_PATHS: Record<string, string> = {
  'credit/account-balances': 'account-balances-credit',
  'books/journal-book': 'daily-journal',
  'books/daily-journal': 'daily-journal',
  'balances/cost-center-balancee': 'cost-center-balance',
  'balances/cost-centers-balancee': 'cost-centers-balance',
};

export function resolveReportApiPath(
  registryPath: string,
  query?: Record<string, string>
): string | null {
  // --- Inventory ---
  if (registryPath.startsWith('inventory/reports/')) {
    const seg = registryPath.slice('inventory/reports/'.length);
    const overrides: Record<string, string> = {
      'sales-reports': 'sales',
      'expiry-date-report': 'expiry-date',
      'purchase-reports': 'purchases',
      'stock-transfer-report': 'stock-transfer',
      'sales-returns-reports': 'sales-returns',
      'purchase-returns-reports': 'purchase-returns',
      'item-movement-reports': 'item-movement',
      'items-profit-reports': 'items-profit-reports',
      'stock-profit-reports': 'stock-profit',
    };
    const apiSeg = overrides[seg] ?? seg;
    return `/inventory/reports/${apiSeg}`;
  }

  // --- Accounting (Wave 0–4 M16 financial reports + legacy fallbacks) ---
  if (registryPath.startsWith('accounting/account-reports/')) {
    const rest = registryPath.slice('accounting/account-reports/'.length);

    const m16Segment = M16_REPORT_PATHS[rest];
    if (m16Segment) {
      return `/accounting/reports/${m16Segment}`;
    }

    if (rest === 'books/general-ledger' || rest === 'books/daftar-ostaz') {
      const accountId = query?.accountId?.trim();
      if (accountId) return `/accounting/reports/account-statement/${accountId}`;
      return `/accounting/reports/general-ledger`;
    }

    const apiSeg = LEGACY_ACCOUNT_REPORT_PATHS[rest] ?? rest.split('/').pop() ?? rest;
    return `/accounting/reports/${apiSeg}`;
  }

  // --- Manufacturing ---
  if (registryPath.startsWith('manufacturing/reports/')) {
    const seg = registryPath.slice('manufacturing/reports/'.length);
    return `/manufacturing/reports/${seg}`;
  }

  // --- Electronic invoices (M21: had a live backend under
  // /api/v1/electronic-invoices/reports/* — sales-invoices,
  // returns-invoices, modified-returns — that this resolver never routed
  // to, so every catalog entry showed "no API path" even though the
  // endpoint existed). ---
  if (registryPath.startsWith('electronic-invoices/reports/')) {
    const seg = registryPath.slice('electronic-invoices/reports/'.length);
    return `/electronic-invoices/reports/${seg}`;
  }

  // --- Extracts (M21: same gap as electronic-invoices — real backend
  // routes existed at /api/v1/extracts/reports/{contractor-payments,
  // projects-status,inventory} with matching segment names). ---
  if (registryPath.startsWith('extracts/reports/')) {
    const seg = registryPath.slice('extracts/reports/'.length);
    return `/extracts/reports/${seg}`;
  }

  // --- HR (M21: this resolver had no HR branch at all. Only two of the
  // catalog's ~15 `hr/*-report` pages have a matching backend report today
  // (`employee-data`, `end-of-service`); the rest (loans, penalties,
  // promotions, rewards, etc.) have no service/route implementation and are
  // intentionally left unresolved — they already render a graceful "no API
  // path" state via UniversalReportViewer rather than a stub with fake
  // data.) ---
  if (registryPath.startsWith('hr/')) {
    const HR_REPORT_PATHS: Record<string, string> = {
      'hr/employee-data-report': 'employee-data',
      'hr/end-of-service-report': 'end-of-service',
    };
    const seg = HR_REPORT_PATHS[registryPath];
    return seg ? `/hr/reports/${seg}` : null;
  }

  // --- Real estate investment (M21: this resolver used to hard-return
  // null for the whole module even though /api/v1/real-estate/reports/*
  // implements every one of these — the frontend "…-investment" catalog
  // segment doesn't match the backend's "real-estate" module name, and two
  // report keys (`customer` / `customer-followup`) are swapped relative to
  // their backend route names, so a plain suffix mapping wouldn't work.) ---
  if (registryPath.startsWith('real-estate-investment/reports/')) {
    const seg = registryPath.slice('real-estate-investment/reports/'.length);
    const overrides: Record<string, string> = {
      // Backend `/customer` is actually the *followup* report; backend
      // `/customer-list` is the generic customer report. See
      // gates-backend/src/modules/real-estate/routes/reports.routes.ts.
      customer: 'customer-list',
      'customer-followup': 'customer',
    };
    const apiSeg = overrides[seg] ?? seg;
    return `/real-estate/reports/${apiSeg}`;
  }

  // --- Import / export: no reports module in backend yet ---
  if (registryPath.startsWith('importexport/reports/')) {
    return null;
  }

  if (registryPath === 'pos/daily' || registryPath.startsWith('pos/')) {
    return '/pos/daily-report';
  }

  return null;
}

const REPORT_TITLE_BY_PATH: Record<string, string> = {
  'inventory/reports/sales-reports': 'تقرير المبيعات',
  'inventory/reports/purchase-reports': 'تقرير المشتريات',
  'inventory/reports/sales-returns-reports': 'تقرير مرتجعات المبيعات',
  'inventory/reports/purchase-returns-reports': 'تقرير مرتجعات المشتريات',
  'inventory/reports/sales-and-returns-reports': 'تقرير المبيعات والمرتجعات',
  'inventory/reports/inventory-reports': 'تقرير أرصدة المخزون',
  'inventory/reports/item-movement-reports': 'تقرير حركة الأصناف',
  'inventory/reports/stock-transfer-report': 'تقرير النقل المخزني',
  'inventory/reports/expiry-date-report': 'تقرير تواريخ الصلاحية',
  'inventory/reports/customer-accounts-reports': 'تقرير حسابات العملاء',
  'inventory/reports/supplier-accounts-reports': 'تقرير حسابات الموردين',
  'inventory/reports/detailed-invoice-movement': 'تقرير حركة الفواتير التفصيلي',
};

const REPORT_TITLE_BY_SLUG: Record<string, string> = {
  'sales-reports': 'تقرير المبيعات',
  'purchase-reports': 'تقرير المشتريات',
};

export function previewTitleFromPath(registryPath: string): string {
  const catalogTitle = getReportByRegistryPath(registryPath)?.titleAr;
  if (catalogTitle) return `معاينة — ${catalogTitle}`;
  const mapped = REPORT_TITLE_BY_PATH[registryPath];
  if (mapped) return `معاينة — ${mapped}`;
  const tail = registryPath.split('/').filter(Boolean).pop() ?? registryPath;
  const slugTitle = REPORT_TITLE_BY_SLUG[tail];
  if (slugTitle) return `معاينة — ${slugTitle}`;
  return `معاينة — ${tail.replace(/-/g, ' ')}`;
}

/** Local calendar day (not UTC), so evening/morning in Egypt does not shift the filter. */
export function localTodayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inventory + accounting reports 400 if fromDate/toDate (or start/end) are missing. */
export function reportPreviewNeedsDateRange(registryPath: string): boolean {
  if (registryPath === 'pos/daily' || registryPath.startsWith('pos/')) return false;
  if (registryPath.startsWith('inventory/reports/')) {
    const seg = registryPath.slice('inventory/reports/'.length);
    return seg !== 'price-list';
  }
  return registryPath.startsWith('accounting/account-reports/');
}

/** Fill a missing date range so preview never calls the API without dates. */
export function ensureReportPreviewDates(
  params: Record<string, string>,
  registryPath: string
): Record<string, string> {
  const today = localTodayIso();
  if (registryPath === 'pos/daily' || registryPath.startsWith('pos/')) {
    const out = { ...params };
    if (!out.date) out.date = out.fromDate || out.toDate || today;
    return out;
  }
  if (!reportPreviewNeedsDateRange(registryPath)) return params;
  const out = { ...params };
  if (!out.fromDate) out.fromDate = today;
  if (!out.toDate) out.toDate = today;
  if (!out.startDate) out.startDate = out.fromDate;
  if (!out.endDate) out.endDate = out.toDate;
  return out;
}

/** Maps UI filter query keys to M16 financial report API query params. */
export function mapReportPreviewQueryParams(
  raw: Record<string, string>,
  registryPath: string
): Record<string, string> {
  const out: Record<string, string> = { ...raw };

  if (raw.fromDate && !out.startDate) out.startDate = raw.fromDate;
  if (raw.toDate && !out.endDate) out.endDate = raw.toDate;

  const isTrialBalance =
    registryPath.includes('review-balance') || registryPath.includes('monthly-review-balance');
  if (isTrialBalance && !out.startDate && out.toDate) {
    const year = out.toDate.slice(0, 4);
    out.startDate = `${year}-01-01`;
    out.endDate = out.toDate;
  }
  if (isTrialBalance && !out.endDate && out.toDate) {
    out.endDate = out.toDate;
  }

  if (
    (registryPath.includes('financial-position-statement') ||
      registryPath.includes('aged-receivables') ||
      registryPath.includes('aged-payables') ||
      registryPath.includes('receivables-aging') ||
      registryPath.includes('overdue-payments')) &&
    !out.asOfDate
  ) {
    out.asOfDate = out.toDate || out.endDate || localTodayIso();
  }

  if (raw.level) out.level = raw.level;
  if (raw.branchId) out.branchId = raw.branchId;
  if (raw.costCenterId) out.costCenterId = raw.costCenterId;
  if (raw.fromVoucher) out.fromVoucher = raw.fromVoucher;
  if (raw.toVoucher) out.toVoucher = raw.toVoucher;

  return out;
}
