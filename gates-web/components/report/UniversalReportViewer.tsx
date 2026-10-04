'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApiQuery } from '@/lib/hooks/useApi';
import type { QueryParams } from '@/lib/api/types';
import {
  resolveReportApiPath,
  mapReportPreviewQueryParams,
  ensureReportPreviewDates,
  reportPreviewNeedsDateRange,
} from '@/lib/reportPreview/resolveReportEndpoint';
import { extractReportPayload } from '@/lib/reportEngine/extractReportPayload';
import { buildReportFilterBadges } from '@/lib/reportEngine/reportFilterBadges';
import { UniversalReportView } from '@/components/report/UniversalReportView';
import {
  comparisonQuery,
  fiscalYearLabel,
  periodYearLabel,
  type FiscalYearOption,
} from '@/lib/reports/compareFiscalYear';
import type { ReportColumnDef } from '@/lib/reportEngine/reportColumns';
import type { ReportBreadcrumb } from '@/lib/reports/reportPageBreadcrumbs';

type NamedEntity = {
  code?: string | null;
  serial?: string | null;
  arabicName?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function accountDisplayName(account?: { code?: string | null; arabicName?: string | null } | null) {
  const arabic = account?.arabicName?.trim() || '';
  const code = account?.code?.trim() || '';
  if (arabic && code) return `${code} — ${arabic}`;
  return arabic || code;
}

function entityLabel(entity?: NamedEntity | null) {
  if (!entity) return '';
  const person = [entity.firstName, entity.lastName].filter(Boolean).join(' ').trim();
  const name = entity.arabicName?.trim() || entity.name?.trim() || person;
  const code = entity.code?.trim() || entity.serial?.trim() || '';
  if (name && code) return `${code} — ${name}`;
  return name || code;
}

function useEntityLabel(id: string, path: string) {
  const { data } = useApiQuery<NamedEntity>(
    ['report-badge-entity', path, id],
    id ? `${path}/${id}` : '/__noop__',
    undefined,
    { enabled: Boolean(id) }
  );
  return entityLabel(data?.data);
}

const PARAM_KEYS = [
  'page',
  'limit',
  'fromDate',
  'toDate',
  'stageId',
  'semesterId',
  'branchId',
  'userId',
  'compareFiscalYearId',
  'studentId',
  'customerId',
  'supplierId',
  'customerCategoryId',
  'supplierCategoryId',
  'accountId',
  'costCenterId',
  'includeDetails',
  'includeSummary',
  'asOfDate',
  'currencyId',
  'itemId',
  'representativeId',
  'warehouseId',
  'delegateId',
  // Wave 5 fix: the sales-report filter page has always put these on the
  // preview URL, but this whitelist silently dropped them before the
  // request ever reached the API.
  'sellerId',
  'driverId',
  'distributorId',
  'additions',
  'otherDiscounts',
  'withholdingTax',
  'salesTax',
  'sortBy',
  'unpaidOnly',
  'fromInvoice',
  'toInvoice',
  'level',
  'employeeId',
  'fromHijri',
  'toHijri',
  'description',
  'counterpartAccountId',
  'fromVoucher',
  'toVoucher',
  'accountView',
  'amountOp',
  'amount',
  'amountTo',
  'startDate',
  'endDate',
  'profileId',
  'itemGroupId',
  'priceListId',
  'serial',
  'allAccounts',
  'totalReport',
  'showUnposted',
  'minValue',
  'ageFromInvoiceFrom',
  'ageFromInvoiceTo',
  'ageFromLastPaymentFrom',
  'ageFromLastPaymentTo',
  'date',
  'otherUnit',
  'priceTier',
  'salePriceSource',
  'showEmpty',
  'showWarehouse',
  'showGroups',
  'inactiveOnly',
  'activeOnly',
  'nonReturnableOnly',
  'returnableOnly',
  'noBelowCostOnly',
  'belowCostOnly',
  'negativeOnly',
  'nonNegativeOnly',
  'hideUnsoldItems',
  'showIdleAccounts',
  'withBudgetOnly',
];

const PAGED_INVOICE_REPORTS = new Set([
  'inventory/reports/sales-reports',
  'inventory/reports/purchase-reports',
  'inventory/reports/sales-returns-reports',
  'inventory/reports/purchase-returns-reports',
  'inventory/reports/sales-and-returns-reports',
]);
const SALES_REPORT_PAGE_SIZE = '50';

function readSavedReportPage(registryPath: string, filterKey: string): number {
  if (typeof window === 'undefined') return 1;
  try {
    const raw = sessionStorage.getItem(`gates:report-page:${registryPath}`);
    if (!raw) return 1;
    const parsed = JSON.parse(raw) as { filterKey?: string; page?: number };
    if (parsed.filterKey === filterKey && typeof parsed.page === 'number' && parsed.page > 0) {
      return parsed.page;
    }
  } catch {
    /* ignore */
  }
  return 1;
}

function writeSavedReportPage(registryPath: string, filterKey: string, page: number) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`gates:report-page:${registryPath}`, JSON.stringify({ filterKey, page }));
  } catch {
    /* ignore quota */
  }
}

export type UniversalReportViewerProps = {
  registryPath: string;
  reportKey: string;
  title: string;
  columnDefs?: ReportColumnDef[];
  exportFileName?: string;
  breadcrumbs?: ReportBreadcrumb[];
  /** When set, filters come from the same page instead of the URL. */
  queryOverride?: Record<string, string>;
  embedded?: boolean;
};

/**
 * Fetches report data from the registry API path and renders {@link UniversalReportView}.
 */
export function UniversalReportViewer({
  registryPath,
  reportKey,
  title,
  columnDefs,
  exportFileName,
  breadcrumbs,
  queryOverride,
  embedded = false,
}: UniversalReportViewerProps) {
  const searchParams = useSearchParams();
  // Static preview pages hydrate with empty searchParams first. Fetching in
  // that window hits GET /sales without dates → 400 English → generic toast.
  const [paramsReady, setParamsReady] = useState(false);
  useEffect(() => setParamsReady(true), []);

  const rawParams = useMemo(() => {
    if (queryOverride) {
      const o: Record<string, string> = {};
      for (const key of PARAM_KEYS) {
        const v = queryOverride[key];
        if (v) o[key] = v;
      }
      return o;
    }
    const o: Record<string, string> = {};
    for (const key of PARAM_KEYS) {
      const v = searchParams.get(key);
      if (v !== null && v !== '') o[key] = v;
    }
    return o;
  }, [queryOverride, searchParams]);

  const params = useMemo(() => {
    const withDates = ensureReportPreviewDates(rawParams, registryPath);
    const mapped = mapReportPreviewQueryParams(withDates, registryPath);
    delete mapped.compareFiscalYearId;
    return mapped;
  }, [rawParams, registryPath]);

  const endpoint = useMemo(
    () => resolveReportApiPath(registryPath, rawParams),
    [registryPath, rawParams]
  );

  const datesReady =
    !reportPreviewNeedsDateRange(registryPath) ||
    Boolean(params.fromDate && params.toDate);

  const paramsKey = useMemo(() => JSON.stringify(params), [params]);
  const invoicePaged = PAGED_INVOICE_REPORTS.has(registryPath);
  const [page, setPage] = useState(() => (invoicePaged ? readSavedReportPage(registryPath, paramsKey) : 1));
  const prevFilterKey = useRef(paramsKey);
  useEffect(() => {
    if (!invoicePaged) return;
    if (prevFilterKey.current === paramsKey) return;
    prevFilterKey.current = paramsKey;
    setPage(readSavedReportPage(registryPath, paramsKey));
  }, [invoicePaged, paramsKey, registryPath]);
  useEffect(() => {
    if (!invoicePaged || !paramsReady || !params.fromDate) return;
    writeSavedReportPage(registryPath, paramsKey, page);
  }, [invoicePaged, paramsReady, params.fromDate, registryPath, paramsKey, page]);
  const requestParams = useMemo(() => {
    if (!invoicePaged) return params;
    return { ...params, page: String(page), limit: SALES_REPORT_PAGE_SIZE };
  }, [invoicePaged, params, page]);
  const requestKey = useMemo(() => JSON.stringify(requestParams), [requestParams]);

  const userId = rawParams.userId?.trim() || '';
  const { data: reportUsersRes } = useApiQuery<
    Array<{ id: string; firstName?: string | null; lastName?: string | null; username?: string | null }>
  >(['report-filter-users'], '/users/report-options', undefined, { enabled: Boolean(userId) });
  const accountId = rawParams.accountId?.trim() || '';
  const counterpartAccountId = rawParams.counterpartAccountId?.trim() || '';
  const { data: selectedAccountRes } = useApiQuery<{ code?: string | null; arabicName?: string | null }>(
    ['report-badge-account', accountId],
    accountId ? `/accounting/accounts/${accountId}` : '/__noop__',
    undefined,
    { enabled: Boolean(accountId) }
  );
  const { data: counterpartAccountRes } = useApiQuery<{ code?: string | null; arabicName?: string | null }>(
    ['report-badge-account', counterpartAccountId],
    counterpartAccountId ? `/accounting/accounts/${counterpartAccountId}` : '/__noop__',
    undefined,
    { enabled: Boolean(counterpartAccountId) }
  );

  const warehouseName = useEntityLabel(rawParams.warehouseId?.trim() || '', '/inventory/warehouses');
  const fromWarehouseName = useEntityLabel(rawParams.fromWarehouseId?.trim() || '', '/inventory/warehouses');
  const toWarehouseName = useEntityLabel(rawParams.toWarehouseId?.trim() || '', '/inventory/warehouses');
  const itemName = useEntityLabel(rawParams.itemId?.trim() || '', '/inventory/items');
  const itemGroupName = useEntityLabel(rawParams.itemGroupId?.trim() || '', '/inventory/item-categories');
  const priceListName = useEntityLabel(rawParams.priceListId?.trim() || '', '/inventory/price-lists');
  const customerName = useEntityLabel(rawParams.customerId?.trim() || '', '/accounting/customers');
  const supplierName = useEntityLabel(rawParams.supplierId?.trim() || '', '/accounting/suppliers');
  const customerGroupName = useEntityLabel(
    rawParams.customerCategoryId?.trim() || '',
    '/accounting/customer-categories'
  );
  const supplierGroupName = useEntityLabel(
    rawParams.supplierCategoryId?.trim() || '',
    '/accounting/supplier-categories'
  );
  const costCenterName = useEntityLabel(rawParams.costCenterId?.trim() || '', '/accounting/cost-centers');
  const currencyName = useEntityLabel(rawParams.currencyId?.trim() || '', '/accounting/currencies');
  const delegateName = useEntityLabel(rawParams.delegateId?.trim() || '', '/accounting/delegates');
  const representativeName = useEntityLabel(rawParams.representativeId?.trim() || '', '/accounting/delegates');
  const sellerName = useEntityLabel(rawParams.sellerId?.trim() || '', '/accounting/delegates');
  const branchId = rawParams.branchId?.trim() || '';
  const { data: branchesRes } = useApiQuery<Array<NamedEntity & { id: string }>>(
    ['report-badge-branches'],
    '/company/branches',
    { limit: 1000, isActive: true },
    { enabled: Boolean(branchId) }
  );
  const branchName = entityLabel((branchesRes?.data ?? []).find((branch) => branch.id === branchId));

  const compareId = rawParams.compareFiscalYearId?.trim() || '';
  const comparesYears =
    reportKey === 'income-statement' ||
    reportKey === 'profit-loss' ||
    reportKey === 'budget' ||
    reportKey === 'cost-centers-balance';
  const { data: fiscalYearsRes } = useApiQuery<FiscalYearOption[]>(
    ['company-fiscal-years', 'report-compare'],
    '/company/fiscal-years',
    { page: 1, limit: 100 },
    { enabled: comparesYears && Boolean(compareId || rawParams.toDate || rawParams.fromDate) }
  );
  const fiscalYears = fiscalYearsRes?.data ?? [];
  const compareYear = fiscalYears.find((year) => year.id === compareId);
  const compareParams = useMemo(
    () => (compareYear ? comparisonQuery(params, compareYear) : undefined),
    [compareYear, params]
  );
  const currentYearLabel = periodYearLabel(fiscalYears, params.fromDate, params.toDate);
  const compareYearLabel = compareYear ? fiscalYearLabel(compareYear) : '';

  const { data, isLoading, isError, error } = useApiQuery<unknown>(
    ['report-preview', registryPath, requestKey],
    endpoint ?? '/__noop__',
    requestParams as QueryParams,
    { enabled: paramsReady && Boolean(endpoint) && datesReady }
  );

  const compareReport = useApiQuery<unknown>(
    ['report-preview-compare', registryPath, compareParams ? JSON.stringify(compareParams) : ''],
    endpoint ?? '/__noop__',
    compareParams as QueryParams,
    { enabled: paramsReady && Boolean(endpoint) && Boolean(compareParams) }
  );
  const comparePayload = useMemo(() => {
    if (!compareParams || !compareReport.data) return { rows: [], summary: undefined as unknown };
    return extractReportPayload(compareReport.data);
  }, [compareParams, compareReport.data]);

  const { rows, summary, pagination } = useMemo(() => {
    if (!endpoint || !data) return { rows: [], summary: undefined, pagination: undefined };
    return extractReportPayload(data);
  }, [data, endpoint]);

  const filterBadges = useMemo(() => {
    const names: Record<string, string> = {};
    const account =
      summary && typeof summary === 'object'
        ? (summary as { account?: { arabicName?: string | null; code?: string | null } }).account
        : undefined;
    const selectedName = accountDisplayName(selectedAccountRes?.data) || accountDisplayName(account);
    if (compareYear) names.compareFiscalYearId = fiscalYearLabel(compareYear);
    const selectedUser = (reportUsersRes?.data ?? []).find((user) => user.id === rawParams.userId);
    if (selectedUser) {
      const userName = [selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ');
      names.userId = userName || selectedUser.username || selectedUser.id;
    }
    if (rawParams.accountId && selectedName) names.accountId = selectedName;
    if (warehouseName) names.warehouseId = warehouseName;
    if (fromWarehouseName) names.fromWarehouseId = fromWarehouseName;
    if (toWarehouseName) names.toWarehouseId = toWarehouseName;
    if (itemName) names.itemId = itemName;
    if (itemGroupName) names.itemGroupId = itemGroupName;
    if (priceListName) names.priceListId = priceListName;
    if (customerName) names.customerId = customerName;
    if (supplierName) names.supplierId = supplierName;
    if (customerGroupName) names.customerCategoryId = customerGroupName;
    if (supplierGroupName) names.supplierCategoryId = supplierGroupName;
    if (branchName) names.branchId = branchName;
    if (delegateName) names.delegateId = delegateName;
    if (representativeName) names.representativeId = representativeName;
    if (sellerName) names.sellerId = sellerName;
    if (costCenterName) names.costCenterId = costCenterName;
    if (currencyName) names.currencyId = currencyName;
    const counterpartName = accountDisplayName(counterpartAccountRes?.data);
    if (rawParams.counterpartAccountId && counterpartName) {
      names.counterpartAccountId = counterpartName;
    }
    const summaryRecord =
      summary && typeof summary === 'object' ? (summary as Record<string, unknown>) : undefined;
    if (rawParams.currencyId && typeof summaryRecord?.currencyName === 'string') {
      const name = summaryRecord.currencyName.trim();
      if (name) names.currencyId = name;
    }
    if (
      rawParams.counterpartAccountId &&
      typeof summaryRecord?.counterpartAccountName === 'string'
    ) {
      const name = summaryRecord.counterpartAccountName.trim();
      if (name) names.counterpartAccountId = name;
    }
    if (rawParams.costCenterId && typeof summaryRecord?.costCenterName === 'string') {
      const name = summaryRecord.costCenterName.trim();
      if (name) names.costCenterId = name;
    }
    const badges = buildReportFilterBadges(rawParams, names);
    if (registryPath.includes('daftar-ostaz') && !rawParams.currencyId) {
      badges.push({ icon: '🔎', label: 'العملة: كل العملات' });
    }
    return badges;
  }, [
    branchName,
    compareYear,
    costCenterName,
    counterpartAccountRes?.data,
    currencyName,
    customerGroupName,
    customerName,
    delegateName,
    itemGroupName,
    itemName,
    priceListName,
    rawParams,
    registryPath,
    reportUsersRes?.data,
    representativeName,
    selectedAccountRes?.data,
    sellerName,
    summary,
    supplierGroupName,
    supplierName,
    warehouseName,
    fromWarehouseName,
    toWarehouseName,
  ]);

  if (!endpoint) {
    return (
      <UniversalReportView
        title={title}
        reportKey={reportKey}
        registryPath={registryPath}
        rows={[]}
        filterBadges={filterBadges}
        isError
        errorMessage="لا يوجد مسار API لهذا التقرير في الخادم حالياً."
        columnDefs={columnDefs}
        breadcrumbs={breadcrumbs}
        embedded={embedded}
        drillQuery={rawParams}
      />
    );
  }

  return (
    <UniversalReportView
      title={title}
      reportKey={reportKey}
      registryPath={registryPath}
      rows={rows}
      summary={summary}
      filterBadges={filterBadges}
      isLoading={isLoading || !paramsReady}
      isError={isError}
      errorMessage={error?.message}
      exportFileName={exportFileName}
      columnDefs={columnDefs}
      breadcrumbs={breadcrumbs}
      embedded={embedded}
      dataKey={paramsKey}
      drillQuery={rawParams}
      pagination={
        invoicePaged && pagination
          ? {
              page: pagination.page,
              totalPages: pagination.totalPages,
              total: pagination.total,
              onPage: setPage,
            }
          : undefined
      }
      compareRows={comparePayload.rows}
      compareSummary={comparePayload.summary}
      currentYearLabel={currentYearLabel}
      compareYearLabel={compareYearLabel}
      compareLoading={Boolean(compareParams) && compareReport.isLoading}
    />
  );
}

export default UniversalReportViewer;
