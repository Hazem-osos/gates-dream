'use client';

import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ElectronicInvoiceTableRow } from '@/lib/electronic-invoices/electronicInvoiceReportUtils';

type Props = {
  rows: ElectronicInvoiceTableRow[];
  isLoading: boolean;
  showReport: boolean;
};

export function ElectronicInvoiceReportTableBody({ rows, isLoading, showReport }: Props) {
  if (!showReport) {
    return (
      <tr>
        <td colSpan={14} className="py-8">
          <EmptyState title="اضغط «عرض الفواتير» لتحميل البيانات من الخادم." />
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
          className={idx % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-[#EAF6FB] border-b border-[#E6F0F7]'}
        >
          <td className="py-3 px-4 text-black">{row.index}</td>
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
        </tr>
      ))}
    </>
  );
}
