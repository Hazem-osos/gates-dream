"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ActionButtons, Button, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { parseDecimal } from '@/lib/money/parseDecimal';

export interface OpenInvoiceRow {
  id: string;
  invoiceNumber: string | null;
  date: string;
  netAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string | null;
  currencyCode: string;
}

interface AllocationRow {
  invoiceId: string;
  invoiceNumber: string | null;
  date: string;
  remainingAmount: number;
  netAmount: number;
  paidAmount: number;
  selected: boolean;
  payAmount: string;
}

interface PaymentsDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashTransactionId?: string | null;
  customerId?: string | null;
  receiptTotal?: number;
  isPosted?: boolean;
  side?: 'receivable' | 'payable';
  partyId?: string | null;
  accountId?: string | null;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
  /** Collect allocations on the voucher before save (no reconcile API). */
  draftMode?: boolean;
  onApplyDraft?: (allocations: { invoiceId: string; allocatedAmount: number }[]) => void;
  onPartyChange?: (partyId: string) => void;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ar-EG');
  } catch {
    return iso;
  }
}

export default function PaymentsDistributionModal({
  isOpen,
  onClose,
  cashTransactionId = null,
  customerId = null,
  receiptTotal = 0,
  isPosted = false,
  side = 'receivable',
  partyId = null,
  accountId = null,
  onError,
  onSuccess,
  draftMode = false,
  onApplyDraft,
}: PaymentsDistributionModalProps) {
  const invalidateQuery = useInvalidateQuery();
  const [rows, setRows] = useState<AllocationRow[]>([]);

  const effectivePartyId = partyId || customerId || '';
  const effectiveAccountId = accountId || '';
  const effectiveCustomerId = side === 'receivable' ? effectivePartyId || null : null;
  const effectiveSupplierId = side === 'payable' ? effectivePartyId || null : null;
  const hasScreenAccount = Boolean(effectivePartyId || effectiveAccountId);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { side };
    if (effectiveCustomerId) p.customerId = effectiveCustomerId;
    if (effectiveSupplierId) p.supplierId = effectiveSupplierId;
    if (!effectiveCustomerId && !effectiveSupplierId && effectiveAccountId) {
      p.accountId = effectiveAccountId;
    }
    return p;
  }, [side, effectiveCustomerId, effectiveSupplierId, effectiveAccountId]);

  const { data: openResponse, isLoading } = useApiQuery<OpenInvoiceRow[]>(
    ['reconcile-open-invoices', side, effectiveCustomerId ?? effectiveSupplierId ?? effectiveAccountId ?? 'none'],
    '/accounting/reconcile/open-invoices',
    queryParams,
    { enabled: isOpen && hasScreenAccount }
  );

  const reconcileMutation = useApiMutation<
    unknown,
    { cashTransactionId: string; allocations: { invoiceId: string; allocatedAmount: number }[] }
  >('/accounting/reconcile', 'POST');

  const fifoMutation = useApiMutation<unknown, { cashTransactionId: string }>(
    '/accounting/reconcile/auto-fifo',
    'POST'
  );

  useEffect(() => {
    if (!hasScreenAccount) {
      setRows([]);
      return;
    }
    const list = openResponse?.data ?? [];
    setRows(
      list.map((inv) => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        remainingAmount: parseDecimal(inv.remainingAmount),
        netAmount: parseDecimal(inv.netAmount),
        paidAmount: parseDecimal(inv.paidAmount),
        selected: false,
        payAmount: '',
      }))
    );
  }, [openResponse, hasScreenAccount]);

  const selectedTotal = rows.reduce((sum, r) => {
    if (!r.selected) return sum;
    return sum + parseDecimal(r.payAmount);
  }, 0);

  const toggleRow = (invoiceId: string, checked: boolean) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.invoiceId !== invoiceId) return r;
        const payAmount = checked ? String(r.remainingAmount) : '';
        return { ...r, selected: checked, payAmount };
      })
    );
  };

  const updatePayAmount = (invoiceId: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.invoiceId === invoiceId ? { ...r, payAmount: value, selected: true } : r))
    );
  };

  const applySelectedToReceiptTotal = () => {
    let left = receiptTotal > 0 ? receiptTotal : Number.POSITIVE_INFINITY;
    setRows((prev) =>
      prev.map((r) => {
        if (!Number.isFinite(left)) {
          return { ...r, selected: true, payAmount: String(r.remainingAmount) };
        }
        if (left <= 0) return { ...r, selected: false, payAmount: '' };
        const pay = Math.min(r.remainingAmount, left);
        left -= pay;
        return { ...r, selected: pay > 0, payAmount: pay > 0 ? String(pay) : '' };
      })
    );
  };

  const handleSave = async () => {
    const allocations = rows
      .filter((r) => r.selected)
      .map((r) => ({
        invoiceId: r.invoiceId,
        allocatedAmount: parseDecimal(r.payAmount),
      }))
      .filter((a) => a.allocatedAmount > 0);

    if (allocations.length === 0) {
      onError?.('اختر فاتورة واحدة على الأقل');
      return;
    }

    if (draftMode) {
      const allocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      if (receiptTotal > 0 && Math.abs(allocated - receiptTotal) > 0.009) {
        onError?.('إجمالي التوزيع يجب أن يساوي مبلغ السند تماماً');
        return;
      }
      onApplyDraft?.(allocations);
      onSuccess?.('تم حفظ توزيع السدادات على الفواتير');
      onClose();
      return;
    }

    if (!cashTransactionId) {
      onError?.('احفظ وارحّل سند القبض أولاً قبل توزيع المبلغ على الفواتير');
      return;
    }
    if (!isPosted) {
      onError?.('يجب ترحيل سند القبض قبل التوزيع على الفواتير');
      return;
    }

    try {
      await reconcileMutation.mutateAsync({
        cashTransactionId,
        allocations,
      });
      invalidateQuery(['reconcile-open-invoices']);
      onSuccess?.('تم توزيع السداد على الفواتير بنجاح');
      onClose();
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'فشل التوزيع');
    }
  };

  const handleAutoFifo = async () => {
    if (draftMode || !cashTransactionId || !isPosted) {
      applySelectedToReceiptTotal();
      return;
    }
    try {
      await fifoMutation.mutateAsync({ cashTransactionId });
      invalidateQuery(['reconcile-open-invoices']);
      onSuccess?.('تم التوزيع التلقائي (الأقدم أولاً)');
      onClose();
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'فشل التوزيع التلقائي');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" style={{ direction: 'rtl' }}>
      <div className="fixed inset-0 bg-black/50 transition-opacity duration-300" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-visible rounded-2xl border border-[#E6F0F7] bg-white shadow-2xl">
          <div className="shrink-0 border-b border-[#E6F0F7] bg-white p-5 text-center">
            <h2 className="text-lg font-bold text-[#0A3D5E]">توزيع السدادات على الفواتير</h2>
            <p className="mt-1 text-xs text-[#5A7A8A]">
              الفواتير تظهر بعد اختيار الحساب في بنود السند، وبعدين توزّع القيمة هنا.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 pt-4">
            <FormSectionCard className="mb-0" bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1">
              {!hasScreenAccount ? (
                <p className="text-center text-gray-600">اختَر حساباً في بنود السند عشان تظهر فواتيره.</p>
              ) : isLoading ? (
                <p className="text-center text-gray-600">جاري تحميل الفواتير...</p>
              ) : rows.length === 0 ? (
                <p className="text-center text-gray-600">لا توجد فواتير مفتوحة لهذا الحساب</p>
              ) : null}
              {rows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-[#E6F0F7] bg-white shadow-sm">
                  <table className="w-full border-separate border-spacing-y-2 overflow-hidden rounded-xl text-sm">
                    <thead>
                      <tr>
                        <th className="rounded-md bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] px-3 py-2 text-center font-bold text-white">
                          تحديد
                        </th>
                        <th className="rounded-md bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] px-3 py-2 text-center font-bold text-white">
                          رقم الفاتورة
                        </th>
                        <th className="rounded-md bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] px-3 py-2 text-center font-bold text-white">
                          التاريخ
                        </th>
                        <th className="rounded-md bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] px-3 py-2 text-center font-bold text-white">
                          القيمة الإجمالية
                        </th>
                        <th className="rounded-md bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] px-3 py-2 text-center font-bold text-white">
                          المسدد سابقاً
                        </th>
                        <th className="rounded-md bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] px-3 py-2 text-center font-bold text-white">
                          المتبقي
                        </th>
                        <th className="rounded-md bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] px-3 py-2 text-center font-bold text-white">
                          المبلغ المراد سداده
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-100">
                      {rows.map((row) => (
                        <tr key={row.invoiceId}>
                          <td className="rounded-md bg-slate-100 px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(e) => toggleRow(row.invoiceId, e.target.checked)}
                            />
                          </td>
                          <td className="rounded-md bg-slate-100 px-3 py-2 text-center text-[#222]">
                            {row.invoiceNumber ?? '—'}
                          </td>
                          <td className="rounded-md bg-slate-100 px-3 py-2 text-center text-[#222]">
                            {formatDate(row.date)}
                          </td>
                          <td className="rounded-md bg-slate-100 px-3 py-2 text-center text-[#222]">
                            {row.netAmount.toLocaleString('ar-EG')}
                          </td>
                          <td className="rounded-md bg-slate-100 px-3 py-2 text-center text-[#222]">
                            {row.paidAmount.toLocaleString('ar-EG')}
                          </td>
                          <td className="rounded-md bg-slate-100 px-3 py-2 text-center text-[#222]">
                            {row.remainingAmount.toLocaleString('ar-EG')}
                          </td>
                          <td className="rounded-md bg-slate-100 px-3 py-2 text-center">
                            <input
                              className={`${compactControlClass} mx-auto max-w-[120px] text-center`}
                              value={row.payAmount}
                              onChange={(e) => updatePayAmount(row.invoiceId, e.target.value)}
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={applySelectedToReceiptTotal}
                  disabled={rows.length === 0}
                >
                  ملء حسب مبلغ السند ({receiptTotal.toLocaleString('ar-EG')})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleAutoFifo()}
                  disabled={fifoMutation.isPending || rows.length === 0}
                >
                  توزيع تلقائي (FIFO)
                </Button>
              </div>

              <div className="mt-2 flex w-full gap-2">
                <div className="flex-1 rounded-l-xl border border-[#C6EAD6] bg-[#E8F7ED] py-3 text-center font-bold text-[#25BB64]">
                  {selectedTotal.toLocaleString('ar-EG')}
                </div>
                <div className="flex-1 rounded-r-xl border border-[#C6EAD6] bg-[#E8F7ED] py-3 text-center font-bold text-[#25BB64]">
                  إجمالي المسدد
                </div>
              </div>
            </FormSectionCard>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[#E6F0F7] p-4">
            <ActionButtons
              onCancel={onClose}
              onSave={() => void handleSave()}
              saveText="حفظ"
              cancelText="تراجع"
              saveDisabled={reconcileMutation.isPending}
              respectPermissions={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
