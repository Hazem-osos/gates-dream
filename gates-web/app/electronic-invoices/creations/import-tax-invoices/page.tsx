'use client';

import { useMemo, useState } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  buildElectronicInvoiceCreationQueryParams,
  sumElectronicInvoiceTotals,
  type ElectronicInvoiceListRow,
} from '@/lib/electronic-invoices/electronicInvoiceCreationUtils';
import { formatElectronicInvoiceDate } from '@/lib/electronic-invoices/electronicInvoiceReportUtils';
import { formatMoneyAr } from '@/lib/formatMoney';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

export default function ImportTaxInvoicesPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showInvoices] = useState(false);
  const [fromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate] = useState(new Date().toISOString().split('T')[0]);

  const listQuery = buildElectronicInvoiceCreationQueryParams({
    invoiceType: 'sales',
    status: 'submitted',
    fromDate,
    toDate,
    limit: 50,
  });

  const { data: listResponse, isLoading: listLoading } = useApiQuery<ElectronicInvoiceListRow[]>(
    ['e-invoice-import-list', fromDate, toDate],
    '/electronic-invoices/invoices',
    listQuery,
    { enabled: showInvoices }
  );

  const tableData = useMemo(() => {
    const rows = listResponse?.data ?? [];
    return rows.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber ?? '—',
      client: inv.customer?.arabicName ?? '—',
      delegate: '—',
      branch: '—',
      invoicePattern: inv.invoiceType,
      invoiceDate: formatElectronicInvoiceDate(inv.invoiceDate),
      currency: '—',
      remainingDays: '—',
      value: formatMoneyAr(inv.totalAmountAfterTax),
      tax: formatMoneyAr(inv.totalTax),
      net: formatMoneyAr(inv.totalAmount),
    }));
  }, [listResponse?.data]);

  const listTotal = useMemo(() => sumElectronicInvoiceTotals(listResponse?.data ?? []), [listResponse?.data]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows([]);
      setSelectAll(false);
    } else {
      setSelectedRows(tableData.map(row => row.id));
      setSelectAll(true);
    }
  };

  const handleRowSelect = (id: string) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter(rowId => rowId !== id));
      setSelectAll(false);
    } else {
      setSelectedRows([...selectedRows, id]);
      if (selectedRows.length + 1 === tableData.length) {
        setSelectAll(true);
      }
    }
  };

  const importMutation = useApiMutation<
    { successCount?: number; failedCount?: number },
    { invoices: Record<string, unknown>[]; options?: Record<string, unknown> }
  >('/electronic-invoices/import', 'POST', {
    onSuccess: (res) => {
      const d = res.data as { successCount?: number; failedCount?: number } | undefined;
      const ok = d?.successCount ?? 0;
      const fail = d?.failedCount ?? 0;
      setSuccess(`اكتمل الاستيراد: نجح ${ok}، فشل ${fail}`);
      invalidateQuery(['electronic-invoices-import']);
    },
    onError: (err: { message?: string }) => {
      setError(err.message || 'فشل الاستيراد');
    },
  });

  const handleImport = () => {
    setError('');
    setSuccess('');
    if (selectedRows.length === 0) {
      setError('يرجى تحديد صفوف للاستيراد');
      return;
    }
    const invoices = tableData
      .filter((row) => selectedRows.includes(row.id))
      .map((row) => ({
        invoiceNumber: String(row.invoiceNumber ?? row.id),
        invoiceDate: new Date().toISOString(),
        customerTaxNumber: String((row as { clientTaxNumber?: string }).clientTaxNumber ?? ''),
        customerName: String(row.client ?? 'عميل'),
        lines: [
          {
            itemCode: 'IMP-001',
            itemName: 'بند استيراد',
            quantity: 1,
            unitPrice: 0,
            taxRate: 0,
          },
        ],
      }));
    importMutation.mutate({
      invoices,
      options: { autoCreateCustomers: true, autoCreateItems: true },
    });
  };

  return (
    <div className="p-4" style={{ direction: 'rtl' }}>
      {/* Page Title */}
      <div className="mb-4">
        <div className="text-right">
          <h1 className="text-lg font-bold text-[#0E78AA] mb-1">إستيراد فواتير ضريبية</h1>
          <div className="h-1 bg-sky-700 rounded w-full"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4">
            {/* Top Action Buttons */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center space-x-4 space-x-reverse">
                <button className="px-4 py-2 bg-white border border-[#D6EAF3] rounded-lg text-[#0E78AA] hover:bg-[#F6FBFD] transition-colors">
                  <span className="text-sm font-medium">تحميل الملف</span>
                </button>
                <button 
                  onClick={handleImport}
                  disabled={importMutation.isPending || selectedRows.length === 0}
                  className="px-4 py-2 bg-white border border-[#D6EAF3] rounded-lg text-[#0E78AA] hover:bg-[#F6FBFD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-sm font-medium">
                    {importMutation.isPending ? 'جاري الاستيراد...' : 'إستيراد البيانات'}
                  </span>
                </button>
              </div>
            </div>

            {/* Information Bar */}
            <div className="mb-6 p-4 bg-white border border-[#D6EAF3] rounded-lg">
              <div className="flex items-center justify-between">
                <div className="px-4 py-2 bg-gray-100 rounded-lg">
                  <span className="text-sm font-medium text-gray-600">240</span>
                </div>
                <span className="text-sm font-medium text-gray-700">عدد الأصناف</span>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white shadow-md min-h-[120px]">
              {!showInvoices ? (
                <EmptyState title="اضغط «عرض الفواتير» لتحميل الفواتير المرسلة للاستيراد." />
              ) : listLoading ? (
                <TableSkeleton columns={12} rows={6} />
              ) : tableData.length === 0 ? (
                <EmptyState title="لا توجد فواتير في هذه الفترة." />
              ) : (
              <table className="w-full text-center border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-[#0E78AA] border-gray-300 rounded focus:ring-[#0E78AA]"
                      />
                    </th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">رقم الفاتورة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">العميل</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">المندوب</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">الفرع</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">نمط الفاتورة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">تاريخ الفاتورة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">العملة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">الأيام المتبقية</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">القيمة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">الضريبة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">الصافي</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 0 ? "bg-[#F6FBFD]" : "bg-[#EAF6FB] border-b border-[#E6F0F7]"}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(row.id)}
                          onChange={() => handleRowSelect(row.id)}
                          className="w-4 h-4 text-[#0E78AA] border-gray-300 rounded focus:ring-[#0E78AA]"
                        />
                      </td>
                      <td className="py-3 px-4 text-black">{row.invoiceNumber}</td>
                      <td className="py-3 px-4 text-black">{row.client}</td>
                      <td className="py-3 px-4 text-black">{row.delegate}</td>
                      <td className="py-3 px-4 text-black">{row.branch}</td>
                      <td className="py-3 px-4 text-black">{row.invoicePattern}</td>
                      <td className="py-3 px-4 text-black">{row.invoiceDate}</td>
                      <td className="py-3 px-4 text-black">{row.currency}</td>
                      <td className="py-3 px-4 text-black">{row.remainingDays}</td>
                      <td className="py-3 px-4 text-black">{row.value}</td>
                      <td className="py-3 px-4 text-black">{row.tax}</td>
                      <td className="py-3 px-4 text-black">{row.net}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>

            {error && <ErrorToast message={error} onClose={() => setError('')} />}
            {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

            {/* Bottom Action Buttons */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#D6EAF3]">
              <div className="flex items-center space-x-4 space-x-reverse">
                <button className="px-4 py-2 bg-white border border-[#D6EAF3] rounded-lg text-[#0E78AA] hover:bg-[#F6FBFD] transition-colors">
                  <span className="text-sm font-medium">التالي</span>
                </button>
                <span className="text-sm text-gray-600">{showInvoices ? formatMoneyAr(listTotal) : '—'}</span>
              </div>
              <button className="px-6 py-2 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors">
                <span className="text-sm font-medium">إغلاق</span>
              </button>
            </div>
          </div>
        </InnerCard>
      </OuterCard>
    </div>
  );
} 