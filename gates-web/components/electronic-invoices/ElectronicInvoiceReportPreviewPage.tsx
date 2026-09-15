'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApiQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReportPageShell } from '@/components/erp/ReportPageHeader';
import { breadcrumbsForReportModule } from '@/lib/reports/reportPageBreadcrumbs';
import {
  type ElectronicInvoiceApiRow,
  type ElectronicInvoiceReportKind,
  filterByInvoiceSelection,
  mapElectronicInvoiceTableRow,
} from '@/lib/electronic-invoices/electronicInvoiceReportUtils';

type Props = {
  reportKind: ElectronicInvoiceReportKind;
  title: string;
};

export default function ElectronicInvoiceReportPreviewPage({ reportKind, title }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  const customerId = searchParams.get('customerId') || undefined;
  const fromDate = searchParams.get('fromDate') || undefined;
  const toDate = searchParams.get('toDate') || undefined;
  const invoiceSelection = searchParams.get('invoiceSelection') || 'all';
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;

  const {
    data: apiResponse,
    isLoading,
    error: queryError,
  } = useApiQuery<ElectronicInvoiceApiRow[]>(
    ['e-invoice-report-preview', reportKind, customerId, fromDate, toDate, String(page)],
    `/electronic-invoices/reports/${reportKind}`,
    {
      customerId,
      fromDate,
      toDate,
      page,
      limit: 100,
    }
  );

  useEffect(() => {
    if (queryError) {
      setError(
        queryError instanceof Error ? queryError.message : 'تعذر تحميل التقرير'
      );
    }
  }, [queryError]);

  const rows = useMemo(() => {
    const raw = apiResponse?.data ?? [];
    const filtered = filterByInvoiceSelection(raw, invoiceSelection);
    return filtered.map(mapElectronicInvoiceTableRow);
  }, [apiResponse?.data, invoiceSelection]);

  const summaryTotal = apiResponse?.summary?.totalAmount;

  return (
    <ReportPageShell
      title={title}
      statusLabel="معاينة"
      breadcrumbs={breadcrumbsForReportModule('electronic-invoices', title)}
      extraActions={
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-8 items-center rounded-lg border border-[#D6EAF3] bg-white px-3 text-xs font-semibold text-[#094C6B] hover:bg-[#F6FBFD]"
        >
          رجوع
        </button>
      }
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white shadow-md">
        {isLoading ? (
          <TableSkeleton columns={10} rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState title="لا توجد بيانات للمعاينة." />
        ) : (
          <table className="w-full text-center border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="bg-[#1787B8] text-white py-3 px-3">م</th>
                <th className="bg-[#1787B8] text-white py-3 px-3">رقم الفاتورة</th>
                <th className="bg-[#1787B8] text-white py-3 px-3">تاريخ الفاتورة</th>
                <th className="bg-[#1787B8] text-white py-3 px-3">العميل</th>
                <th className="bg-[#1787B8] text-white py-3 px-3">القيمة</th>
                <th className="bg-[#1787B8] text-white py-3 px-3">الحالة</th>
                <th className="bg-[#1787B8] text-white py-3 px-3">أرسل</th>
                <th className="bg-[#1787B8] text-white py-3 px-3">تاريخ الإرسال</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                  <td className="py-2 px-3">{row.index}</td>
                  <td className="py-2 px-3">{row.invoiceNumber}</td>
                  <td className="py-2 px-3">{row.invoiceDate}</td>
                  <td className="py-2 px-3">{row.clientName}</td>
                  <td className="py-2 px-3">{row.value}</td>
                  <td className="py-2 px-3">{row.status}</td>
                  <td className="py-2 px-3">{row.sent}</td>
                  <td className="py-2 px-3">{row.submissionDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {summaryTotal != null && !isLoading ? (
        <p className="mt-4 text-sm text-[#094C6B] text-right">
          إجمالي القيمة (الصفحة):{' '}
          {Number(summaryTotal).toLocaleString('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      ) : null}
    </ReportPageShell>
  );
}
