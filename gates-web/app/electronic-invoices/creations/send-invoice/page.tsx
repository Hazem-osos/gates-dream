'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useMemo, useState } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import AccountingTable from '@/components/AccountingTable';
import { useApiQuery } from '@/lib/hooks/useApi';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  buildElectronicInvoiceCreationQueryParams,
  mapElectronicInvoiceToAccountingTableRows,
  sumElectronicInvoiceTotals,
  type ElectronicInvoiceListRow,
} from '@/lib/electronic-invoices/electronicInvoiceCreationUtils';
import { formatMoneyAr } from '@/lib/formatMoney';

export default function SendElectronicInvoicePage() {
  useBackendReachability();

  const [filters, setFilters] = useState({
    clientCode: '',
    fromDate: new Date().toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
  });
  const [showInvoices, setShowInvoices] = useState(false);
  const [page, setPage] = useState(1);

  const queryParams = buildElectronicInvoiceCreationQueryParams({
    invoiceType: 'sales',
    status: 'draft',
    customerId: filters.clientCode || undefined,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    page,
    limit: 50,
  });

  const { data: listResponse, isLoading } = useApiQuery<ElectronicInvoiceListRow[]>(
    [
      'e-invoice-creation',
      'sales',
      'draft',
      filters.clientCode,
      filters.fromDate,
      filters.toDate,
      String(page),
    ],
    '/electronic-invoices/invoices',
    queryParams,
    { enabled: showInvoices }
  );

  const invoices = listResponse?.data ?? [];
  const tableRows = useMemo(
    () => mapElectronicInvoiceToAccountingTableRows(invoices),
    [invoices]
  );
  const listTotal = useMemo(() => sumElectronicInvoiceTotals(invoices), [invoices]);
  const totalPages = listResponse?.pagination?.totalPages ?? 1;
  const totalCount = listResponse?.pagination?.total ?? invoices.length;

  const columns = [
    { label: 'الصافي', align: 'right' as const },
    { label: 'الضريبة', align: 'right' as const },
    { label: 'القيمة', align: 'right' as const },
    { label: 'تاريخ الفاتورة', align: 'right' as const },
    { label: 'المندوب', align: 'right' as const },
    { label: 'العميل', align: 'right' as const },
    { label: 'رقم الفاتورة', align: 'right' as const },
  ];

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      <div className="mb-6">
        <div className="text-right">
          <h1 className="text-xl font-bold text-[#0E78AA] mb-2">إرسال الفواتير الإلكترونية</h1>
          <div className="h-1 bg-sky-700 rounded w-full"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-6">
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">كود العميل (اختياري)</label>
                <input
                  type="text"
                  value={filters.clientCode}
                  onChange={(e) => setFilters({ ...filters, clientCode: e.target.value })}
                  className="w-full p-3 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">من التاريخ</label>
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                    className="w-full p-3 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">إلى التاريخ</label>
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                    className="w-full p-3 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4 space-x-reverse flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setShowInvoices(true);
                  }}
                  className="px-4 py-2 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B]"
                >
                  عرض الفواتير
                </button>
              </div>
              <div className="px-4 py-2 bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg text-gray-700 font-semibold">
                {showInvoices ? totalCount : '—'}
              </div>
            </div>

            <div className="mb-6 min-h-[120px]">
              {!showInvoices ? (
                <EmptyState title="اضغط «عرض الفواتير» لتحميل مسودات فواتير المبيعات من الخادم." />
              ) : isLoading ? (
                <TableSkeleton columns={7} rows={6} />
              ) : tableRows.length === 0 ? (
                <EmptyState title="لا توجد فواتير مسودة في هذه الفترة." />
              ) : (
                <AccountingTable columns={columns} rows={tableRows} />
              )}
            </div>

            {showInvoices && totalPages > 1 ? (
              <div className="flex justify-center gap-2 mb-4">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded bg-[#0E78AA] text-white disabled:opacity-40"
                >
                  السابق
                </button>
                <span className="text-sm text-gray-600 self-center">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded bg-[#0E78AA] text-white disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            ) : null}

            <div className="flex items-center justify-start gap-4 mb-5">
              <div className="px-4 py-2 bg-[#F6FBFD] border border-[#D6EAF3] rounded-lg text-gray-700 font-semibold">
                {showInvoices ? formatMoneyAr(listTotal) : '—'}
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-[#D6EAF3]">
              <button type="button" className="px-6 py-3 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B]">
                إغلاق
              </button>
            </div>
          </div>
        </InnerCard>
      </OuterCard>
    </div>
  );
}
