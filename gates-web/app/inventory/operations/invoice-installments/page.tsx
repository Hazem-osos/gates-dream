'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { erpInputClass, erpLabelClass } from '@/components/erp';
import { erpTableHeadCellClass, erpTableHeadRowClass } from '@/components/erp/erpUiTokens';
import { Button } from '@/components/ui';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { CustomerSelect } from '@/components/form/PartySelect';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { toast } from '@/lib/feedback/toast';
import type { ApiError } from '@/lib/api/types';
import { InvoiceCollectModal } from '@/components/inventory/sales-invoice/InvoiceCollectModal';

type TrackerRow = {
  id: string;
  invoiceId: string;
  invoiceNumber?: string | null;
  customerName?: string | null;
  installmentNumber: number;
  dueDate: string;
  hijriDueDate?: string | null;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  isPaid: boolean;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  paymentStatusLabel: string;
};

const STATUS_OPTIONS = [
  { value: '', label: 'كل الحالات' },
  { value: 'UNPAID', label: 'غير مسددة' },
  { value: 'PENDING', label: 'مستحقة' },
  { value: 'PARTIALLY_PAID', label: 'مسددة جزئياً' },
  { value: 'OVERDUE', label: 'متأخرة' },
  { value: 'PAID', label: 'مسددة' },
];

export default function InvoiceInstallmentsTrackerPage() {
  const router = useRouter();
  const invalidateQuery = useInvalidateQuery();
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [collectRow, setCollectRow] = useState<TrackerRow | null>(null);

  const params = useMemo(
    () => ({
      invoiceKind: 'SALE',
      customerId: customerId || undefined,
      status: status || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    [customerId, status, fromDate, toDate]
  );

  const { data: trackerResponse, isLoading } = useApiQuery<TrackerRow[]>(
    ['invoice-installments-tracker'],
    '/invoices/installments',
    params
  );
  const { data: safesResponse } = useApiQuery<Array<{ id: string; arabicName?: string; code?: string | null }>>(
    ['accounting', 'safes', 'installment-tracker'],
    '/accounting/safes'
  );
  const rows = trackerResponse?.data ?? [];

  const collectMutation = useApiMutation<unknown, Record<string, unknown>>(
    collectRow ? `/invoices/${collectRow.invoiceId}/installments/${collectRow.id}/collect` : '/invoices',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        toast.success('تم تسجيل سند القبض وربطه بالقسط');
        setCollectRow(null);
        invalidateQuery(['invoice-installments-tracker']);
        invalidateQuery(['invoices']);
      },
      onError: (error: ApiError) => {
        toast.error('تعذر تحصيل القسط', { description: error.message });
      },
    }
  );

  return (
    <ErpDocumentLayout>
      <div className="rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#0A3D5E]">تتبع أقساط الفواتير والتحصيلات</h1>
            <p className="mt-1 text-sm text-slate-500">
              رقم الفاتورة، العميل، رقم الدفعة، الاستحقاق، القيمة، المسدد، وحالة السداد
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.push('/inventory/operations/sales-invoice')}
          >
            فاتورة المبيعات
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={erpLabelClass}>العميل</label>
            <CustomerSelect
              value={customerId}
              onChange={setCustomerId}
              className={erpInputClass}
              emptyLabel="كل العملاء"
            />
          </div>
          <div>
            <label className={erpLabelClass}>حالة السداد</label>
            <select className={erpInputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={erpLabelClass}>من تاريخ الاستحقاق</label>
            <input type="date" className={erpInputClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className={erpLabelClass}>إلى تاريخ الاستحقاق</label>
            <input type="date" className={erpInputClass} value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className={erpTableHeadRowClass}>
                <th className={erpTableHeadCellClass}>رقم الفاتورة</th>
                <th className={erpTableHeadCellClass}>القيمة</th>
                <th className={erpTableHeadCellClass}>المبلغ المسدد</th>
                <th className={erpTableHeadCellClass}>تاريخ الاستحقاق</th>
                <th className={erpTableHeadCellClass}>التاريخ الهجري</th>
                <th className={erpTableHeadCellClass}>العميل</th>
                <th className={erpTableHeadCellClass}>رقم الدفعة</th>
                <th className={erpTableHeadCellClass}>حالة السداد</th>
                <th className={erpTableHeadCellClass}>تحصيل</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    جاري التحميل…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    لا توجد أقساط مطابقة
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="font-semibold text-[#0E78AA] hover:underline"
                        onClick={() =>
                          router.push(`/inventory/operations/sales-invoice?invoiceId=${row.invoiceId}`)
                        }
                      >
                        {row.invoiceNumber || row.invoiceId.slice(0, 8)}
                      </button>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatInvoiceMoney(row.amount)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatInvoiceMoney(row.paidAmount)}</td>
                    <td className="px-3 py-2">{new Date(row.dueDate).toLocaleDateString('ar-EG')}</td>
                    <td className="px-3 py-2">{row.hijriDueDate || '—'}</td>
                    <td className="px-3 py-2">{row.customerName || '—'}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{row.installmentNumber}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          row.status === 'PAID'
                            ? 'text-emerald-700'
                            : row.status === 'OVERDUE'
                              ? 'text-red-700'
                              : 'text-slate-700'
                        }
                      >
                        {row.paymentStatusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.status === 'PAID' ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <Button type="button" size="sm" variant="secondary" onClick={() => setCollectRow(row)}>
                          تحصيل
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {collectRow ? (
        <InvoiceCollectModal
          open
          remaining={collectRow.remainingAmount}
          safes={safesResponse?.data ?? []}
          defaultSafeId={safesResponse?.data?.[0]?.id}
          pending={collectMutation.isPending}
          onClose={() => setCollectRow(null)}
          onConfirm={(payload) => collectMutation.mutate(payload)}
        />
      ) : null}
    </ErpDocumentLayout>
  );
}
