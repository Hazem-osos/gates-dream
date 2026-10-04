'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { EtaInvoiceStatusDialog } from '@/components/electronic-invoices/EtaInvoiceStatusDialog';
import type { ElectronicInvoiceTableRow } from '@/lib/electronic-invoices/electronicInvoiceReportUtils';

type Props = {
  rows: ElectronicInvoiceTableRow[];
  isLoading: boolean;
  showReport: boolean;
  invoiceHref?: (id: string) => string;
};

export function ElectronicInvoiceReportTableBody({ rows, isLoading, showReport, invoiceHref }: Props) {
  const router = useRouter();
  const [statusInvoiceId, setStatusInvoiceId] = useState<string | null>(null);
  if (!showReport) {
    return (
      <tr>
        <td colSpan={14} className="py-8">
          <EmptyState title="اضغط «معاينة التقرير» لتحميل البيانات." />
        </td>
      </tr>
    );
  }

  if (isLoading) {
    return (
      <tr>
        <td colSpan={14} className="py-4">
          <TableSkeleton columns={14} rows={5} />
        </td>
      </tr>
    );
  }

  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={14} className="py-8">
          <EmptyState title="لا توجد فواتير مطابقة للمرشحات." />
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((row, idx) => (
        <tr
          key={row.id}
          className={`${idx % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-[#EAF6FB] border-b border-[#E6F0F7]'} cursor-pointer hover:bg-sky-50`}
          onClick={() => {
            const href = invoiceHref?.(row.id) ?? `/inventory/operations/sales-invoice?invoiceId=${encodeURIComponent(row.id)}`;
            router.push(href);
          }}
        >
          <td className="py-3 px-4 text-black">{row.patternName}</td>
          <td className="py-3 px-4 text-black">{row.invoiceNumber}</td>
          <td className="py-3 px-4 text-black">{row.invoiceDate}</td>
          <td className="py-3 px-4 text-black">{row.clientCode}</td>
          <td className="py-3 px-4 text-black">{row.clientName}</td>
          <td className="py-3 px-4 text-black">{row.value}</td>
          <td className="py-3 px-4 text-black">{row.branch}</td>
          <td className="py-3 px-4 text-black">{row.currency}</td>
          <td className="py-3 px-4 text-black">{row.status}</td>
          <td className="py-3 px-4 text-black">{row.remainingDays}</td>
          <td className="py-3 px-4 text-black">{row.sent}</td>
          <td className="py-3 px-4 text-black">{row.submissionDate}</td>
          <td className="py-3 px-4 text-black">{row.sentBy}</td>
          <td className="py-3 px-4 text-black">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold"
              onClick={(event) => {
                event.stopPropagation();
                setStatusInvoiceId(row.id);
              }}
            >
              حالة الفاتورة الإلكترونية
            </button>
          </td>
        </tr>
      ))}
      {statusInvoiceId ? (
        <EtaInvoiceStatusDialog invoiceId={statusInvoiceId} onClose={() => setStatusInvoiceId(null)} />
      ) : null}
    </>
  );
}
