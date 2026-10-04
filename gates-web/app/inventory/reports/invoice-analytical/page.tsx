'use client';

import { useEffect, useMemo, useState } from 'react';
import { recalledTabSearch } from '@/lib/navigation/tab-memory';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { writeReportSearch } from '@/lib/reports/reportQueryUrl';
import {
  ReportFilterCheckbox,
  ReportFilterDate,
  ReportFilterOptionsRow,
  ReportFilterPageShell,
  ReportFilterPartySelect,
  ReportFilterSelect,
  ReportFilterWarehouseSelect,
} from '@/components/report/reportFilterFields';
import { UnifiedReportFilterCard } from '@/components/report/UnifiedReportFilterCard';
import { InvoiceAnalyticalSheet, type InvoiceAnalyticalCard } from '@/components/report/InvoiceAnalyticalSheet';
import { useApiQuery } from '@/lib/hooks/useApi';
import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';

const defaultFilters = () => ({
  ...reportDefaultDateRange(),
  kind: '',
  customerId: '',
  supplierId: '',
  warehouseId: '',
  allAccounts: true,
  showUnposted: true,
});

type AnalyticalFilters = ReturnType<typeof defaultFilters>;

function filtersToSearch(filters: AnalyticalFilters): Record<string, string> {
  return {
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    kind: filters.kind,
    customerId: filters.customerId,
    supplierId: filters.supplierId,
    warehouseId: filters.warehouseId,
    allAccounts: filters.allAccounts ? 'true' : 'false',
    showUnposted: filters.showUnposted ? 'true' : 'false',
    preview: '1',
  };
}

function filtersFromSearch(search: string): AnalyticalFilters | null {
  const entries = Object.fromEntries(new URLSearchParams(search));
  if (!entries.fromDate || !entries.toDate) return null;
  return {
    ...defaultFilters(),
    fromDate: entries.fromDate,
    toDate: entries.toDate,
    kind: entries.kind ?? '',
    customerId: entries.customerId ?? '',
    supplierId: entries.supplierId ?? '',
    warehouseId: entries.warehouseId ?? '',
    allAccounts: entries.allAccounts !== 'false',
    showUnposted: entries.showUnposted !== 'false',
  };
}

export default function InvoiceAnalyticalPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [applied, setApplied] = useState<AnalyticalFilters | null>(null);
  const patch = (part: Partial<AnalyticalFilters>) =>
    setFilters((prev) => ({ ...prev, ...part }));

  useEffect(() => {
    const path = normalizeAppPath(window.location.pathname);
    const fromWindow = window.location.search.replace(/^\?/, '');
    const restored = filtersFromSearch(fromWindow || recalledTabSearch(path));
    if (!restored) return;
    setFilters(restored);
    setApplied(restored);
    const built = new URLSearchParams(filtersToSearch(restored)).toString();
    if (built !== fromWindow) writeReportSearch(filtersToSearch(restored));
  }, []);

  const queryParams = useMemo(() => {
    if (!applied) return null;
    return {
      fromDate: applied.fromDate,
      toDate: applied.toDate,
      kind: applied.kind || undefined,
      partyId: applied.customerId || applied.supplierId || undefined,
      warehouseId: applied.warehouseId || undefined,
      showUnposted: applied.showUnposted ? 'true' : undefined,
    };
  }, [applied]);

  const { data, isFetching, error } = useApiQuery<InvoiceAnalyticalCard[]>(
    ['invoice-analytical', queryParams],
    '/reports/invoice-analytical',
    queryParams ?? undefined,
    { enabled: Boolean(queryParams) }
  );

  const cards = data?.data ?? [];
  const summary = (data?.summary ?? {}) as { invoiceCount?: number; truncated?: boolean };

  return (
    <ReportFilterPageShell
      title="التقرير التحليلي للفواتير"
      description="كل فاتورة بأصنافها وخصمها وضريبتها ودفعاتها والمتبقي عليها."
      breadcrumbs={[
        { label: 'المخزون', href: '/inventory' },
        { label: 'التقارير', href: '/inventory/reports' },
        { label: 'التقرير التحليلي للفواتير' },
      ]}
      error={error?.message}
    >
      <UnifiedReportFilterCard
        icon="📑"
        title="التقرير التحليلي للفواتير"
        showTitle={false}
        onPreview={() => {
          setApplied(filters);
          writeReportSearch(filtersToSearch(filters));
        }}
        onReset={() => {
          setFilters(defaultFilters());
          setApplied(null);
          writeReportSearch(null);
        }}
      >
        <ReportFilterDate label="من تاريخ" value={filters.fromDate} onChange={(fromDate) => patch({ fromDate })} />
        <ReportFilterDate label="إلى تاريخ" value={filters.toDate} onChange={(toDate) => patch({ toDate })} />
        <ReportFilterSelect
          label="نوع الفاتورة"
          value={filters.kind}
          onChange={(kind) => patch({ kind })}
          options={[
            { value: 'SALE', label: 'فاتورة مبيعات' },
            { value: 'SALE_RETURN', label: 'مردود مبيعات' },
            { value: 'PURCHASE', label: 'فاتورة مشتريات' },
            { value: 'PURCHASE_RETURN', label: 'مردود مشتريات' },
          ]}
          placeholder="كل الفواتير"
        />
        <ReportFilterPartySelect
          label="العميل"
          kind="CUSTOMER"
          value={filters.customerId}
          onChange={(customerId) => patch({ customerId, supplierId: customerId ? '' : filters.supplierId })}
          emptyLabel="كل العملاء"
          includeAllAccounts={filters.allAccounts}
        />
        <ReportFilterPartySelect
          label="المورد"
          kind="SUPPLIER"
          value={filters.supplierId}
          onChange={(supplierId) => patch({ supplierId, customerId: supplierId ? '' : filters.customerId })}
          emptyLabel="كل الموردين"
          includeAllAccounts={filters.allAccounts}
        />
        <ReportFilterWarehouseSelect
          label="المخزن"
          value={filters.warehouseId}
          onChange={(warehouseId) => patch({ warehouseId })}
          emptyLabel="كل المخازن"
        />
        <ReportFilterOptionsRow>
          <ReportFilterCheckbox
            id="invoice-analytical-unposted"
            label="إظهار العمليات غير المرحّلة"
            checked={filters.showUnposted}
            onChange={(showUnposted) => patch({ showUnposted })}
          />
          <ReportFilterCheckbox
            id="invoice-analytical-accounts"
            label="كل الحسابات"
            checked={filters.allAccounts}
            onChange={(allAccounts) => patch({ allAccounts })}
          />
        </ReportFilterOptionsRow>
      </UnifiedReportFilterCard>

      {applied ? (
        <div className="mt-5 space-y-3">
          {isFetching ? <p className="text-sm text-slate-500">جارٍ تحميل الفواتير…</p> : null}
          {!isFetching && summary.invoiceCount != null ? (
            <p className="text-sm text-slate-600">
              {summary.invoiceCount.toLocaleString('en-US')} فاتورة
              {summary.truncated ? ' — يُعرض أول 200 فاتورة. ضيّق الفترة لرؤية الباقي.' : ''}
            </p>
          ) : null}
          {!isFetching ? <InvoiceAnalyticalSheet cards={cards} /> : null}
        </div>
      ) : null}
    </ReportFilterPageShell>
  );
}
