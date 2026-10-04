'use client';

import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';

import { useMemo, useState } from 'react';
import {
  ReportFilterCheckbox,
  ReportFilterDate,
  ReportFilterField,
  ReportFilterOptionsRow,
  ReportFilterPartySelect,
  ReportFilterSelect,
  ReportFilterPageShell,
  reportFilterInputClass,
} from '@/components/report/reportFilterFields';
import { UnifiedReportFilterCard } from '@/components/report/UnifiedReportFilterCard';
import { UniversalReportView } from '@/components/report/UniversalReportView';
import { useApiQuery } from '@/lib/hooks/useApi';
import { SOURCE_TYPE_OPTIONS } from '@/lib/invoices/sourceDocument';
import { useDocumentProfiles } from '@/lib/hooks/useDocumentProfiles';
import { DOCUMENT_BASE_TYPE_LABELS, type DocumentBaseType } from '@/lib/document-profiles/types';

type MovementRow = {
  id: string;
  sourceType: string;
  sourceTypeLabel: string;
  sourceNumber: string;
  sourceDate: string | null;
  partyName: string;
  itemName: string;
  unitName: string;
  orderedQty: number;
  unitPrice: number;
  orderedTotal: number;
  issuedQty: number;
  remainingQty: number;
  invoiceNumber: string;
  status: 'مفتوح' | 'جزئي' | 'مكتمل' | 'ملغي';
};

type MovementSummary = {
  lineCount: number;
  orderedQty: number;
  issuedQty: number;
  remainingQty: number;
  issueQty: number;
};

const REPORT_TITLE = 'تقرير استخدام عروض الأسعار وأوامر الشراء';

const WAREHOUSE_ENTRY_TYPES = new Set<DocumentBaseType>([
  'SALES_INVOICE',
  'SALES_RETURN',
  'PURCHASE_INVOICE',
  'PURCHASE_RETURN',
  'STOCK_ISSUE',
  'STOCK_RECEIPT',
]);

const defaultFilters = () => ({
  ...reportDefaultDateRange(),
  sourceType: '',
  customerId: '',
  supplierId: '',
  status: '',
  search: '',
  allAccounts: true,
});

function qty(n: number) {
  return n.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
}

export default function AnalyticalInvoicesPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);
  const profilesQuery = useDocumentProfiles();
  const sectionOptions = useMemo(() => {
    const profiles = (profilesQuery.data?.data ?? []).filter(
      (profile) => profile.isActive && WAREHOUSE_ENTRY_TYPES.has(profile.baseType)
    );
    const patternOptions = profiles.map((profile) => ({
      value: `profile:${profile.id}`,
      label: `${DOCUMENT_BASE_TYPE_LABELS[profile.baseType]} — ${profile.nameAr}`,
    }));
    return [
      { value: '', label: 'كل الأقسام' },
      ...SOURCE_TYPE_OPTIONS.map((opt) => ({
        value: opt.value,
        label: `${opt.icon} ${opt.label}`,
      })),
      { value: 'DELIVERY_NOTE', label: '📤 إذن صرف مخزني' },
      ...patternOptions,
    ];
  }, [profilesQuery.data?.data]);

  const patch = (p: Partial<ReturnType<typeof defaultFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const queryParams = useMemo(
    () => ({
      fromDate: applied.fromDate || undefined,
      toDate: applied.toDate || undefined,
      sourceType: applied.sourceType.startsWith('profile:') ? undefined : applied.sourceType || undefined,
      profileId: applied.sourceType.startsWith('profile:') ? applied.sourceType.slice('profile:'.length) : undefined,
      partyId: applied.customerId || applied.supplierId || undefined,
      status: applied.status || undefined,
      search: applied.search || undefined,
      page: 1,
      limit: 2000,
    }),
    [applied]
  );

  const { data, isFetching, error } = useApiQuery<MovementRow[]>(
    ['analytical-invoice-movement', queryParams],
    '/reports/analytical-invoice-movement',
    queryParams
  );

  const rows = data?.data ?? [];
  const summary = (data?.summary ?? {}) as Partial<MovementSummary>;
  const lineCount = Number(summary.lineCount ?? rows.length);
  const orderedQty = Number(summary.orderedQty ?? 0);
  const issuedQty = Number(summary.issuedQty ?? 0);
  const remainingQty = Number(summary.remainingQty ?? 0);
  const issueQty = Number(summary.issueQty ?? 0);

  return (
    <ReportFilterPageShell
      title={REPORT_TITLE}
      description="استخدام عروض الأسعار وأوامر الشراء: الكمية والسعر وما صُرف وما تبقى."
      breadcrumbs={[
        { label: 'المخزون', href: '/inventory' },
        { label: 'التقارير', href: '/inventory/reports' },
        { label: REPORT_TITLE },
      ]}
      error={error?.message}
    >
      <UnifiedReportFilterCard
        icon="📑"
        title={REPORT_TITLE}
        showTitle={false}
        onPreview={() => setApplied(filters)}
        onReset={() => {
          const next = defaultFilters();
          setFilters(next);
          setApplied(next);
        }}
      >
        <ReportFilterDate
          label="من تاريخ"
          value={filters.fromDate}
          onChange={(fromDate) => patch({ fromDate })}
        />
        <ReportFilterDate
          label="إلى تاريخ"
          value={filters.toDate}
          onChange={(toDate) => patch({ toDate })}
        />
        <ReportFilterSelect
          label="القسم"
          value={filters.sourceType}
          onChange={(sourceType) => patch({ sourceType })}
          options={sectionOptions}
          placeholder="كل الأقسام"
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
        <ReportFilterSelect
          label="حالة التحويل"
          value={filters.status}
          onChange={(status) => patch({ status })}
          options={[
            { value: '', label: 'كل الحالات' },
            { value: 'مفتوح', label: 'مفتوح' },
            { value: 'جزئي', label: 'جزئي' },
            { value: 'مكتمل', label: 'مكتمل' },
            { value: 'ملغي', label: 'ملغي' },
          ]}
        />
        <ReportFilterField label="بحث">
          <input
            className={reportFilterInputClass}
            value={filters.search}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="رقم المستند أو الصنف أو الجهة"
          />
        </ReportFilterField>
        <ReportFilterOptionsRow>
          <ReportFilterCheckbox
            id="analytical-all-accounts"
            label="كل الحسابات"
            checked={filters.allAccounts}
            onChange={(allAccounts) => patch({ allAccounts })}
          />
        </ReportFilterOptionsRow>
      </UnifiedReportFilterCard>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard title="البنود" value={lineCount.toLocaleString('ar-EG')} />
        <SummaryCard title="الكمية" value={qty(orderedQty)} />
        <SummaryCard title="المصروف من العروض والأوامر" value={qty(issuedQty)} />
        <SummaryCard title="المتبقي" value={qty(remainingQty)} />
        <SummaryCard title="إذن صرف مخزني" value={qty(issueQty)} />
      </div>

      <UniversalReportView
        embedded
        title={REPORT_TITLE}
        reportKey="analytical-invoices"
        registryPath="inventory/reports/analytical-invoices"
        rows={rows as unknown as Record<string, unknown>[]}
        summary={summary}
        isLoading={isFetching}
        dataKey={JSON.stringify(applied)}
      />
    </ReportFilterPageShell>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#D6EAF3] bg-white px-4 py-4 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-bold text-[#0A3D5E]">{value}</div>
    </div>
  );
}
