'use client';

import { useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { useDocumentProfiles } from '@/lib/hooks/useDocumentProfiles';
import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';
import {
  ReportFilterBranchSelect,
  ReportFilterCheckbox,
  ReportFilterCostCenterSelect,
  ReportFilterDate,
  ReportFilterDelegateSelect,
  ReportFilterField,
  ReportFilterItemGroupSelect,
  ReportFilterItemSelect,
  ReportFilterOptionsRow,
  ReportFilterPartySelect,
  ReportFilterSection,
  ReportFilterUserSelect,
  ReportFilterWarehouseSelect,
  reportFilterInputClass,
} from '@/components/report/reportFilterFields';
import { ElectronicInvoiceReportTableBody } from '@/components/electronic-invoices/ElectronicInvoiceReportTableBody';
import { buildSalesInvoicePatternOptions } from '@/lib/electronic-invoices/salesPatterns';
import {
  buildElectronicInvoiceReportQueryParams,
  mapElectronicInvoiceTableRow,
  type ElectronicInvoiceApiRow,
} from '@/lib/electronic-invoices/electronicInvoiceReportUtils';
import { exportTableToExcel, printElementById, type ExportColumnDef } from '@/lib/export/export-utils';
import type { DocumentBaseType } from '@/lib/document-profiles/types';

const TABLE_HEADERS = [
  'اسم النمط',
  'رقم الفاتورة',
  'تاريخ الفاتورة',
  'كود العميل',
  'اسم العميل',
  'القيمة',
  'الفرع',
  'العملة',
  'الحالة',
  'الأيام المتبقية',
  'UUID',
  'تاريخ الإرسال',
  'أرسل بواسطة',
  'حالة الفاتورة الإلكترونية',
];

const EXPORT_COLUMNS: ExportColumnDef<Record<string, unknown>>[] = [
  { id: 'patternName', header: 'اسم النمط', getValue: (r) => r.patternName ?? '—' },
  { id: 'invoiceNumber', header: 'رقم الفاتورة', getValue: (r) => r.invoiceNumber ?? '—' },
  { id: 'invoiceDate', header: 'تاريخ الفاتورة', getValue: (r) => r.invoiceDate ?? '—' },
  { id: 'clientCode', header: 'كود العميل', getValue: (r) => r.clientCode ?? '—' },
  { id: 'clientName', header: 'اسم العميل', getValue: (r) => r.clientName ?? '—' },
  { id: 'value', header: 'القيمة', getValue: (r) => r.value ?? '—' },
  { id: 'branch', header: 'الفرع', getValue: (r) => r.branch ?? '—' },
  { id: 'currency', header: 'العملة', getValue: (r) => r.currency ?? '—' },
  { id: 'status', header: 'الحالة', getValue: (r) => r.status ?? '—' },
  { id: 'remainingDays', header: 'الأيام المتبقية', getValue: (r) => r.remainingDays ?? '—' },
  { id: 'sent', header: 'UUID', getValue: (r) => r.sent ?? '—' },
  { id: 'sentBy', header: 'أرسل بواسطة', getValue: (r) => r.sentBy ?? '—' },
  { id: 'submissionDate', header: 'تاريخ الإرسال', getValue: (r) => r.submissionDate ?? '—' },
];

const SELECTION_OPTIONS = [
  { value: 'sent', label: 'فواتير مرسلة' },
  { value: 'unsent', label: 'فواتير غير مرسلة' },
  { value: 'all', label: 'كل الفواتير' },
] as const;

function today() {
  return new Date().toISOString().split('T')[0];
}

function emptyFilters() {
  return {
    customerId: '',
    delegateId: '',
    warehouseId: '',
    branchId: '',
    itemId: '',
    itemGroupId: '',
    costCenterId: '',
    sentByUserId: '',
    invoiceDateFrom: today(),
    invoiceDateTo: today(),
    submittedFrom: '',
    submittedTo: '',
    invoiceSelection: 'sent',
    invoiceNumber: '',
    patternIds: [] as string[],
  };
}

export type ElectronicInvoiceReportFilterPageProps = {
  urlPath: string;
  apiPath: string;
  previewPath: string;
  titleHint?: string;
  queryKey: string;
  tableId: string;
  exportFileBase: string;
  reportKind?: 'sales' | 'returns' | 'modified';
};

export function ElectronicInvoiceReportFilterPage({
  urlPath,
  apiPath,
  titleHint,
  queryKey,
  tableId,
  exportFileBase,
  reportKind = 'sales',
}: ElectronicInvoiceReportFilterPageProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(emptyFilters);

  const profileBaseType: DocumentBaseType =
    reportKind === 'returns' ? 'SALES_RETURN' : 'SALES_INVOICE';
  const { data: profilesRes } = useDocumentProfiles({ baseType: profileBaseType });
  const { data: modulesRes } = useApiQuery<
    {
      id: string;
      fullCode?: string | null;
      nameAr?: string | null;
      menuNameAr?: string | null;
      isActive?: boolean;
    }[]
  >(
    ['new-modules', 'SI', 'einvoice-report'],
    '/new-modules',
    { baseType: 'SI' },
    { enabled: reportKind !== 'returns' }
  );
  const patternOptions = useMemo(() => {
    if (reportKind === 'returns') {
      return (profilesRes?.data ?? []).map((profile) => ({
        id: profile.id,
        label: profile.nameAr,
      }));
    }
    return buildSalesInvoicePatternOptions({
      profiles: profilesRes?.data ?? [],
      modules: modulesRes?.data ?? [],
    });
  }, [modulesRes?.data, profilesRes?.data, reportKind]);

  const patch = (p: Partial<typeof filters>) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...p }));
  };

  const togglePattern = (id: string, checked: boolean) => {
    patch({
      patternIds: checked
        ? [...filters.patternIds, id]
        : filters.patternIds.filter((current) => current !== id),
    });
  };

  const reportQueryParams = buildElectronicInvoiceReportQueryParams({
    ...filters,
    page,
  });

  const { data: reportResponse, isLoading: reportLoading } = useApiQuery<ElectronicInvoiceApiRow[]>(
    [queryKey, reportQueryParams],
    apiPath,
    reportQueryParams,
    { enabled: showReport }
  );

  const tableRows = useMemo(
    () => (reportResponse?.data ?? []).map(mapElectronicInvoiceTableRow),
    [reportResponse?.data]
  );

  const handlePreview = () => {
    setPage(1);
    setShowReport(true);
    setError('');
    requestAnimationFrame(() => {
      document.getElementById(tableId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const summaryTotal = reportResponse?.summary?.totalAmount as number | undefined;
  const totalPages = reportResponse?.pagination?.totalPages ?? 1;
  const reportTitle = urlPath.includes('modified-returns')
    ? 'الإشعارات المدينة'
    : urlPath.includes('returns-invoices')
      ? 'الإشعارات الدائنة'
      : 'تقرير الفواتير الإلكترونية';

  return (
    <CatalogReportFilterShell
      urlPath={urlPath}
      onPreview={handlePreview}
      onReset={() => {
        setFilters(emptyFilters());
        setPage(1);
        setShowReport(false);
      }}
      error={error}
      onClearError={() => setError('')}
      settingsOpen={showSettings}
      onSettingsOpenChange={setShowSettings}
      subtitle={titleHint}
    >
      <ReportFilterSection title="الأنماط والطرف">
        <ReportFilterField label="الأنماط" className="sm:col-span-2">
          <div className="flex max-h-28 flex-wrap gap-2 overflow-auto rounded-lg border border-[#D6EAF3] bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
            {patternOptions.length === 0 ? (
              <span className="px-1 text-sm text-slate-500">فاتورة مبيعات</span>
            ) : (
              patternOptions.map((pattern) => (
                <ReportFilterCheckbox
                  key={pattern.id}
                  id={`${queryKey}-pattern-${pattern.id}`}
                  label={pattern.label}
                  checked={filters.patternIds.includes(pattern.id)}
                  onChange={(checked) => togglePattern(pattern.id, checked)}
                />
              ))
            )}
          </div>
        </ReportFilterField>
        <ReportFilterPartySelect
          label="العميل"
          kind="CUSTOMER"
          value={filters.customerId}
          onChange={(customerId) => patch({ customerId })}
          emptyLabel="كل العملاء"
        />
        <ReportFilterDelegateSelect
          label="المندوب"
          value={filters.delegateId}
          onChange={(delegateId) => patch({ delegateId })}
        />
        <ReportFilterWarehouseSelect
          label="المخزن"
          value={filters.warehouseId}
          onChange={(warehouseId) => patch({ warehouseId })}
        />
        <ReportFilterBranchSelect
          value={filters.branchId}
          onChange={(branchId) => patch({ branchId })}
        />
      </ReportFilterSection>

      <ReportFilterSection title="الصنف والإرسال">
        <ReportFilterItemSelect
          label="الصنف"
          value={filters.itemId}
          onChange={(itemId) => patch({ itemId })}
        />
        <ReportFilterItemGroupSelect
          label="المجموعة"
          value={filters.itemGroupId}
          onChange={(itemGroupId) => patch({ itemGroupId })}
        />
        <ReportFilterCostCenterSelect
          label="مركز التكلفة"
          value={filters.costCenterId}
          onChange={(costCenterId) => patch({ costCenterId })}
        />
        <ReportFilterUserSelect
          label="أرسلت بواسطة"
          value={filters.sentByUserId}
          onChange={(sentByUserId) => patch({ sentByUserId })}
          emptyLabel="كل المستخدمين"
        />
        <ReportFilterField label="رقم الفاتورة">
          <input
            className={reportFilterInputClass}
            value={filters.invoiceNumber}
            placeholder="كل الأرقام"
            onChange={(e) => patch({ invoiceNumber: e.target.value })}
          />
        </ReportFilterField>
      </ReportFilterSection>

      <ReportFilterSection title="التواريخ">
        <ReportFilterDate
          label="من تاريخ الفاتورة"
          value={filters.invoiceDateFrom}
          onChange={(invoiceDateFrom) => patch({ invoiceDateFrom })}
        />
        <ReportFilterDate
          label="إلى تاريخ الفاتورة"
          value={filters.invoiceDateTo}
          onChange={(invoiceDateTo) => patch({ invoiceDateTo })}
        />
        <ReportFilterDate
          label="من تاريخ الإرسال"
          value={filters.submittedFrom}
          onChange={(submittedFrom) => patch({ submittedFrom })}
        />
        <ReportFilterDate
          label="إلى تاريخ الإرسال"
          value={filters.submittedTo}
          onChange={(submittedTo) => patch({ submittedTo })}
        />
      </ReportFilterSection>

      <ReportFilterOptionsRow>
        {SELECTION_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
              filters.invoiceSelection === option.value
                ? 'border-[#0E78AA] bg-[#F4FAFC] text-[#094C6B]'
                : 'border-[#D6EAF3] bg-white text-slate-600'
            }`}
          >
            <input
              type="radio"
              name={`${queryKey}-selection`}
              className="accent-[#0E78AA]"
              checked={filters.invoiceSelection === option.value}
              onChange={() => patch({ invoiceSelection: option.value })}
            />
            {option.label}
          </label>
        ))}
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="inline-flex h-9 items-center rounded-lg border border-[#D6EAF3] px-3 text-sm font-semibold text-[#094C6B] hover:bg-[#F6FBFD]"
        >
          إعدادات التقرير
        </button>
      </ReportFilterOptionsRow>

      <div className="col-span-full overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white" id={tableId}>
        <table className="w-full min-w-[1100px] text-center border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {TABLE_HEADERS.map((header) => (
                <th key={header} className="whitespace-nowrap bg-[#1787B8] px-3 py-3 font-bold text-white">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ElectronicInvoiceReportTableBody
              rows={tableRows}
              isLoading={reportLoading}
              showReport={showReport}
              invoiceHref={(id) => {
                const q = encodeURIComponent(id);
                if (urlPath.includes('return')) {
                  return `/inventory/operations/sales-returns?invoiceId=${q}`;
                }
                return `/inventory/operations/sales-invoice?invoiceId=${q}`;
              }}
            />
          </tbody>
        </table>
      </div>

      <ReportFilterOptionsRow>
        <button
          type="button"
          onClick={() => {
            if (!showReport || !tableRows.length) {
              setError('اعرض التقرير أولاً ثم حاول الطباعة');
              return;
            }
            printElementById(tableId, reportTitle);
          }}
          className="inline-flex h-9 items-center rounded-lg border border-[#D6EAF3] px-3 text-sm font-semibold text-[#094C6B] hover:bg-[#F6FBFD]"
        >
          طباعة
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!showReport || !tableRows.length) {
              setError('اعرض التقرير أولاً ثم حاول التصدير');
              return;
            }
            try {
              await exportTableToExcel(exportFileBase, EXPORT_COLUMNS, tableRows as Record<string, unknown>[]);
            } catch {
              setError('تعذر تصدير التقرير');
            }
          }}
          className="inline-flex h-9 items-center rounded-lg border border-[#D6EAF3] px-3 text-sm font-semibold text-[#094C6B] hover:bg-[#F6FBFD]"
        >
          تصدير لإكسل
        </button>
      </ReportFilterOptionsRow>

      {showReport ? (
        <div className="col-span-full flex items-center justify-between text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-[#D6EAF3] px-4 py-2 disabled:opacity-50"
            >
              السابق
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-lg bg-[#0E78AA] px-4 py-2 text-white disabled:opacity-50"
            >
              التالي
            </button>
            <span>
              {page} / {totalPages}
            </span>
          </div>
          <span>
            إجمالي القيمة:{' '}
            {summaryTotal != null
              ? Number(summaryTotal).toLocaleString('ar-EG', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '—'}
          </span>
        </div>
      ) : null}
    </CatalogReportFilterShell>
  );
}
