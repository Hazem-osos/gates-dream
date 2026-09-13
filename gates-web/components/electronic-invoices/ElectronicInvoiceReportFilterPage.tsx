'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiQuery } from '@/lib/hooks/useApi';
import { CatalogReportFilterShell } from '@/components/report/CatalogReportFilterShell';
import {
  ReportFilterDate,
  ReportFilterField,
  ReportFilterOptionsRow,
  ReportFilterPartySelect,
  ReportFilterSection,
  ReportFilterSelect,
  ReportFilterWarehouseSelect,
  reportFilterInputClass,
} from '@/components/report/reportFilterFields';
import { ElectronicInvoiceReportTableBody } from '@/components/electronic-invoices/ElectronicInvoiceReportTableBody';
import {
  buildElectronicInvoiceReportQueryParams,
  filterByInvoiceSelection,
  mapElectronicInvoiceTableRow,
  type ElectronicInvoiceApiRow,
} from '@/lib/electronic-invoices/electronicInvoiceReportUtils';
import { exportTableToExcel, printElementById, type ExportColumnDef } from '@/lib/export/export-utils';

const EXPORT_COLUMNS: ExportColumnDef<Record<string, unknown>>[] = [
  { id: 'invoiceNumber', header: 'رقم الفاتورة', getValue: (r) => r.invoiceNumber ?? '—' },
  { id: 'clientName', header: 'العميل', getValue: (r) => r.clientName ?? '—' },
  { id: 'invoiceDate', header: 'التاريخ', getValue: (r) => r.invoiceDate ?? '—' },
  { id: 'value', header: 'القيمة', getValue: (r) => r.value ?? '—' },
];

export type ElectronicInvoiceReportFilterPageProps = {
  urlPath: string;
  apiPath: string;
  previewPath: string;
  titleHint?: string;
  queryKey: string;
  tableId: string;
  exportFileBase: string;
};

export function ElectronicInvoiceReportFilterPage({
  urlPath,
  apiPath,
  previewPath,
  titleHint,
  queryKey,
  tableId,
  exportFileBase,
}: ElectronicInvoiceReportFilterPageProps) {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    customerId: '',
    warehouseId: '',
    invoiceDateFrom: new Date().toISOString().split('T')[0],
    invoiceDateTo: new Date().toISOString().split('T')[0],
    invoiceSelection: 'sent',
    invoiceNumber: '',
  });

  const patch = (p: Partial<typeof filters>) => setFilters((prev) => ({ ...prev, ...p }));

  const reportQueryParams = buildElectronicInvoiceReportQueryParams({
    clientCode: filters.customerId,
    invoiceDateFrom: filters.invoiceDateFrom,
    invoiceDateTo: filters.invoiceDateTo,
    page,
  });

  const { data: reportResponse, isLoading: reportLoading } = useApiQuery<ElectronicInvoiceApiRow[]>(
    [queryKey, filters.customerId, filters.invoiceDateFrom, filters.invoiceDateTo, String(page), filters.invoiceSelection],
    apiPath,
    reportQueryParams,
    { enabled: showReport }
  );

  const tableRows = useMemo(() => {
    const raw = reportResponse?.data ?? [];
    const filtered = filterByInvoiceSelection(raw, filters.invoiceSelection);
    return filtered.map(mapElectronicInvoiceTableRow);
  }, [reportResponse?.data, filters.invoiceSelection]);

  const handlePreview = () => {
    const params = new URLSearchParams();
    if (filters.customerId) params.append('customerId', filters.customerId);
    if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
    params.append('fromDate', filters.invoiceDateFrom);
    params.append('toDate', filters.invoiceDateTo);
    if (filters.invoiceSelection) params.append('invoiceSelection', filters.invoiceSelection);
    if (filters.invoiceNumber) params.append('invoiceNumber', filters.invoiceNumber);
    router.push(`${previewPath}?${params.toString()}`);
  };

  const summaryTotal = reportResponse?.summary?.totalAmount as number | undefined;
  const totalPages = reportResponse?.pagination?.totalPages ?? 1;

  return (
    <CatalogReportFilterShell
      urlPath={urlPath}
      onPreview={handlePreview}
      onReset={() => {
        setFilters({
          customerId: '',
          warehouseId: '',
          invoiceDateFrom: new Date().toISOString().split('T')[0],
          invoiceDateTo: new Date().toISOString().split('T')[0],
          invoiceSelection: 'sent',
          invoiceNumber: '',
        });
        setShowReport(false);
      }}
      error={error}
      onClearError={() => setError('')}
      settingsOpen={showSettings}
      onSettingsOpenChange={setShowSettings}
      subtitle={titleHint}
    >
      <ReportFilterSection title="المرشحات">
        <ReportFilterPartySelect
          label="العميل"
          kind="CUSTOMER"
          value={filters.customerId}
          onChange={(customerId) => patch({ customerId })}
          emptyLabel="كل العملاء"
        />
        <ReportFilterWarehouseSelect
          label="المخزن"
          value={filters.warehouseId}
          onChange={(warehouseId) => patch({ warehouseId })}
        />
        <ReportFilterField label="رقم الفاتورة">
          <input
            className={reportFilterInputClass}
            value={filters.invoiceNumber}
            onChange={(e) => patch({ invoiceNumber: e.target.value })}
          />
        </ReportFilterField>
        <ReportFilterSelect
          label="اختيار الفواتير"
          value={filters.invoiceSelection}
          onChange={(invoiceSelection) => patch({ invoiceSelection })}
          options={[
            { value: 'sent', label: 'المرسلة' },
            { value: 'unsent', label: 'غير المرسلة' },
            { value: 'all', label: 'الكل' },
          ]}
          placeholder="المرسلة"
        />
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
      </ReportFilterSection>

      <ReportFilterOptionsRow>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setShowReport(true);
          }}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-xl"
        >
          عرض الفواتير
        </button>
        <button
          type="button"
          onClick={() => {
            if (!showReport || !tableRows.length) {
              setError('اعرض الفواتير أولاً ثم حاول الطباعة');
              return;
            }
            printElementById(tableId, 'تقرير الفواتير الإلكترونية');
          }}
          className="inline-flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-xl text-sm"
        >
          طباعة
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!showReport || !tableRows.length) {
              setError('اعرض الفواتير أولاً ثم حاول التصدير');
              return;
            }
            try {
              await exportTableToExcel(exportFileBase, EXPORT_COLUMNS, tableRows as Record<string, unknown>[]);
            } catch {
              setError('تعذر تصدير التقرير');
            }
          }}
          className="inline-flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-xl text-sm"
        >
          تصدير
        </button>
      </ReportFilterOptionsRow>

      <div className="col-span-full overflow-x-auto rounded-2xl border border-slate-200 bg-white" id={tableId}>
        <table className="w-full text-center border-separate border-spacing-0">
          <thead>
            <tr>
              {['م', 'رقم الفاتورة', 'تاريخ الفاتورة', 'كود العميل', 'إسم العميل', 'القيمة', 'الحالة'].map(
                (h) => (
                  <th key={h} className="bg-[#1787B8] text-white py-3 px-4 font-bold">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            <ElectronicInvoiceReportTableBody
              rows={tableRows}
              isLoading={reportLoading}
              showReport={showReport}
            />
          </tbody>
        </table>
      </div>

      {showReport ? (
        <div className="col-span-full flex items-center justify-between text-sm text-slate-600">
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg disabled:opacity-50"
          >
            التالي
          </button>
          <span>
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
