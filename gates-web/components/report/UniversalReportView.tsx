'use client';

import '@/styles/print-report.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReportMetricCards } from '@/components/report/ReportMetricCards';
import { ReportColumnPicker } from '@/components/report/ReportColumnPicker';
import {
  getReportColumnsForPath,
  getRowCellValue,
  type ReportColumnDef,
} from '@/lib/reportEngine/reportColumns';
import { useReportColumnVisibility } from '@/lib/reportEngine/useReportColumnVisibility';
import { formatReportCell } from '@/lib/reportEngine/reportFormatters';
import type { ReportFilterBadge } from '@/lib/reportEngine/reportFilterBadges';
import { exportTableToExcel } from '@/lib/export/export-utils';
import { printDom } from '@/lib/print/printHtml';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { formatUserDisplayName, type UserProfile } from '@/lib/user/profile';

export type UniversalReportViewProps = {
  title: string;
  reportKey: string;
  registryPath: string;
  rows: Record<string, unknown>[];
  summary?: unknown;
  filterBadges?: ReportFilterBadge[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  exportFileName?: string;
  columnDefs?: ReportColumnDef[];
};

function ReportTable({
  rows,
  columns,
}: {
  rows: Record<string, unknown>[];
  columns: ReportColumnDef[];
}) {
  if (!columns.length) {
    return <p className="text-center text-slate-600 py-6">لا توجد أعمدة للعرض.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white report-print-table-wrap">
      <table className="w-full text-sm text-center report-print-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                className="bg-[#1787B8] text-white py-3 px-2 font-medium whitespace-nowrap no-print:bg-[#1787B8]"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
              {columns.map((col) => {
                const raw = getRowCellValue(row, col);
                const currency =
                  typeof row.currencyCode === 'string' ? row.currencyCode : 'ج.م';
                const { text, badge } = formatReportCell(raw, col.format ?? 'text', {
                  currencyCode: currency === 'EGP' ? 'ج.م' : currency,
                  badgeMap: col.badgeMap,
                });
                return (
                  <td key={col.id} className="py-2 px-2 border-b border-slate-100 text-slate-800">
                    {badge ? (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium report-print-badge ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    ) : (
                      text
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UniversalReportView({
  title,
  reportKey,
  registryPath,
  rows,
  summary,
  filterBadges = [],
  isLoading,
  isError,
  errorMessage,
  exportFileName,
  columnDefs,
}: UniversalReportViewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { profile } = useCompanyPrintProfile();
  const { data: userResp } = useApiQuery<UserProfile>(
    queryKeys.userMe,
    '/users/me',
    undefined,
    { staleTime: 300_000, retry: 1 }
  );
  const printedBy = userResp?.data
    ? formatUserDisplayName(userResp.data)
    : 'مستخدم النظام';

  const allColumns = useMemo(() => {
    if (columnDefs?.length) return columnDefs;
    return getReportColumnsForPath(registryPath, rows);
  }, [columnDefs, registryPath, rows]);

  const {
    visibleColumns,
    visibleIds,
    setColumnVisible,
    selectAll,
    selectRecommended,
    pickableColumns,
  } = useReportColumnVisibility(reportKey, allColumns);

  const [generatedAt, setGeneratedAt] = useState('');
  useEffect(() => {
    setGeneratedAt(
      new Date().toLocaleString('ar-EG', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  }, []);

  const pending = !mounted || Boolean(isLoading);

  const handlePrint = useCallback(() => {
    const root = document.getElementById('report-print-root');
    if (!root) return;
    void printDom(root, title);
  }, [title]);

  const handleExport = useCallback(async () => {
    const file = exportFileName ?? `${reportKey}-report`;
    const exportCols = visibleColumns.map((col) => ({
      id: col.id,
      header: col.label,
      getValue: (row: Record<string, unknown>) => {
        const raw = getRowCellValue(row, col);
        const { text } = formatReportCell(raw, col.format ?? 'text', {
          badgeMap: col.badgeMap,
          currencyCode:
            typeof row.currencyCode === 'string' ? row.currencyCode : 'ج.م',
        });
        return text;
      },
    }));
    await exportTableToExcel(file, exportCols, rows, 'التقرير');
  }, [exportFileName, reportKey, rows, visibleColumns]);

  return (
    <div className="min-h-screen bg-[#F6FBFD] p-6" dir="rtl">
      <div id="report-print-root" className="w-full max-w-none">
        {mounted ? (
          <div className="report-print-header-brand report-print-only">
            <div className="text-right">
              <div className="font-bold text-lg">{profile?.nameAr ?? 'الشركة'}</div>
              {profile?.taxRegistrationNumber ? (
                <div className="text-xs text-slate-600">ر.ض: {profile.taxRegistrationNumber}</div>
              ) : null}
            </div>
            {profile?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logoUrl} alt="" className="h-12 object-contain" />
            ) : null}
          </div>
        ) : null}

        <div className="no-print mb-4 space-y-3">
          <h1 className="text-xl font-bold text-[#0E78AA] text-right">{title}</h1>
          <div className="flex flex-wrap gap-2 justify-end">
            {filterBadges.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-full px-3 py-1 text-slate-700"
              >
                <span aria-hidden>{b.icon}</span>
                {b.label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0E78AA] text-white text-sm font-medium hover:bg-[#0c6894]"
            >
              <span aria-hidden>🖨️</span>
              طباعة التقرير
            </button>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={!rows.length}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <span aria-hidden>📊</span>
              تصدير Excel
            </button>
            <ReportColumnPicker
              columns={pickableColumns}
              visibleIds={visibleIds}
              onToggle={setColumnVisible}
              onSelectAll={selectAll}
              onSelectRecommended={selectRecommended}
            />
          </div>
        </div>

        {mounted ? (
          <div className="report-print-only text-center mb-4">
            <h1 className="text-lg font-bold">{title}</h1>
            {generatedAt ? (
              <p className="text-xs text-slate-600 mt-1">تاريخ الإنشاء: {generatedAt}</p>
            ) : null}
            {filterBadges.length ? (
              <p className="text-xs text-slate-600 mt-1">
                {filterBadges.map((b) => b.label).join(' · ')}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="h-1 bg-sky-700 w-full mb-4 no-print" />

        {pending ? (
          <div className="py-4 no-print">
            <TableSkeleton rows={8} columns={6} />
          </div>
        ) : null}

        {!pending && isError ? (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4 mb-4 no-print">
            {errorMessage ?? 'فشل تحميل التقرير.'}
          </p>
        ) : null}

        {!pending && summary != null ? <ReportMetricCards summary={summary} /> : null}

        {!pending && !isError && rows.length === 0 ? (
          <EmptyState
            title="لا توجد بيانات"
            description="لا توجد نتائج للتقرير ضمن مرشحات التاريخ والفرع الحالية."
          />
        ) : null}

        {!pending && !isError && rows.length > 0 ? (
          <ReportTable rows={rows} columns={visibleColumns} />
        ) : null}

        {mounted ? (
          <div className="report-print-footer report-print-only">
            <span>طُبع بواسطة: {printedBy}</span>
            <span className="report-print-page" />
            <span>تقرير نظام Gates — للاستخدام الداخلي</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
