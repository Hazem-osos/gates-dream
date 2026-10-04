'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PreliminaryStatusBadge } from '@/components/contracting/preliminary/PreliminaryStatusBadge';
import { PreliminaryStatusStepper } from '@/components/contracting/preliminary/PreliminaryStatusStepper';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import type { ContractVariationOrder, ContractVariationChangeType } from '@/lib/contracting/variation-types';
import { CHANGE_TYPE_LABEL } from '@/lib/contracting/variation-types';
import type { OwnerBoqItem } from '@/lib/contracting/types';
import { toast } from '@/lib/feedback/toast';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp, formatQty, toDateInput, toMoney } from '@/lib/subcontracts/money';
import type { ApiError } from '@/lib/api/types';

type LineDraft = {
  changeType: ContractVariationChangeType;
  projectBOQItemId?: string;
  itemCodeSnapshot: string;
  descriptionArSnapshot: string;
  unitSnapshot: string;
  quantityDelta: number;
  approvedRate?: number;
  notes?: string;
};

function translateVoError(error: unknown): string {
  const msg = error && typeof error === 'object' && 'message' in error ? String((error as ApiError).message) : '';
  if (msg.includes('OVER_CERTIFICATION') || msg.includes('certified')) {
    return 'الكمية الفعالة بعد أمر التغيير أقل من الكميات المعتمدة مسبقاً.';
  }
  if (msg.includes('انتقال غير مسموح')) return 'الإجراء غير متاح في هذه الحالة.';
  return msg || 'حدث خطأ';
}

export function ContractVariationWorkspace({
  projectId,
  contractId,
  variationOrderId,
}: {
  projectId: string;
  contractId: string;
  variationOrderId?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const boqQ = useApiQuery<OwnerBoqItem[]>(
    queryKeys.contracting.ownerBoq(projectId),
    `/contracting/technical-office/projects/${projectId}/boq`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const boqItems = boqQ.data?.data ?? [];

  const orderQ = useQuery({
    queryKey: ['contract-variation', contractId, variationOrderId],
    enabled: Boolean(variationOrderId),
    queryFn: async () => {
      const res = await apiClient.get<ContractVariationOrder>(
        `/contracting/client-billing/contracts/${contractId}/variation-orders/${variationOrderId}`
      );
      return res.data!;
    },
  });
  const order = orderQ.data;
  const status = order?.status ?? 'DRAFT';

  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (!order) return;
    setOrderDate(toDateInput(order.orderDate));
    setReason(order.reason);
    setLines(
      order.lines.map((l) => ({
        changeType: l.changeType,
        projectBOQItemId: l.projectBOQItemId ?? undefined,
        itemCodeSnapshot: l.itemCodeSnapshot,
        descriptionArSnapshot: l.descriptionArSnapshot,
        unitSnapshot: l.unitSnapshot,
        quantityDelta: toMoney(l.quantityDelta),
        approvedRate: l.approvedRate != null ? toMoney(l.approvedRate) : undefined,
        notes: l.notes ?? undefined,
      }))
    );
  }, [order]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['contract-variation-list', contractId] });
    if (variationOrderId) {
      void queryClient.invalidateQueries({ queryKey: ['contract-variation', contractId, variationOrderId] });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () =>
      apiClient.post<ContractVariationOrder>(`/contracting/client-billing/contracts/${contractId}/variation-orders`, {
        variationOrderId,
        orderDate,
        reason,
        lines: lines.map((l) => ({
          changeType: l.changeType,
          projectBOQItemId: l.projectBOQItemId ?? null,
          itemCodeSnapshot: l.itemCodeSnapshot,
          descriptionArSnapshot: l.descriptionArSnapshot,
          unitSnapshot: l.unitSnapshot,
          quantityDelta: l.quantityDelta,
          approvedRate: l.approvedRate ?? null,
          notes: l.notes ?? null,
        })),
      }),
    onSuccess: (res) => {
      notifyApiSuccess('تم حفظ أمر التغيير');
      if (!variationOrderId && res.data?.id) {
        router.replace(`/contracting/projects/${projectId}/variation-orders/${res.data.id}`);
      } else invalidate();
    },
    onError: (e) => toast.error(translateVoError(e)),
  });

  const submitM = useMutation({
    mutationFn: async () =>
      apiClient.patch(
        `/contracting/client-billing/contracts/${contractId}/variation-orders/${variationOrderId}/submit`,
        {}
      ),
    onSuccess: () => {
      notifyApiSuccess('تم الإرسال');
      invalidate();
    },
    onError: (e) => toast.error(translateVoError(e)),
  });
  const reviewM = useMutation({
    mutationFn: async () =>
      apiClient.patch(
        `/contracting/client-billing/contracts/${contractId}/variation-orders/${variationOrderId}/begin-review`,
        {}
      ),
    onSuccess: () => {
      notifyApiSuccess('تحت المراجعة');
      invalidate();
    },
    onError: (e) => toast.error(translateVoError(e)),
  });
  const approveM = useMutation({
    mutationFn: async () =>
      apiClient.patch(
        `/contracting/client-billing/contracts/${contractId}/variation-orders/${variationOrderId}/approve`,
        {}
      ),
    onSuccess: () => {
      notifyApiSuccess('تم الاعتماد');
      invalidate();
    },
    onError: (e) => toast.error(translateVoError(e)),
  });
  const rejectM = useMutation({
    mutationFn: async () =>
      apiClient.patch(
        `/contracting/client-billing/contracts/${contractId}/variation-orders/${variationOrderId}/reject`,
        { reason: rejectReason }
      ),
    onSuccess: () => {
      notifyApiSuccess('تم الرفض');
      invalidate();
    },
    onError: (e) => toast.error(translateVoError(e)),
  });
  const cancelM = useMutation({
    mutationFn: async () =>
      apiClient.patch(
        `/contracting/client-billing/contracts/${contractId}/variation-orders/${variationOrderId}/cancel`,
        { reason: cancelReason }
      ),
    onSuccess: () => {
      notifyApiSuccess('تم الإلغاء');
      invalidate();
    },
    onError: (e) => toast.error(translateVoError(e)),
  });

  const displayLines = useMemo(() => {
    if (order?.lines?.length) return order.lines;
    return null;
  }, [order?.lines]);

  const editable = status === 'DRAFT';

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        changeType: 'QUANTITY_CHANGE',
        itemCodeSnapshot: '',
        descriptionArSnapshot: '',
        unitSnapshot: 'M3',
        quantityDelta: 0,
      },
    ]);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-xl border border-[#E6F0F7] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-[#094C6B]">{order?.orderNumber ?? 'أمر تغيير جديد'}</h2>
          <PreliminaryStatusBadge status={status} />
        </div>
        <PreliminaryStatusStepper status={status} />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block">تاريخ الأمر</span>
            <Input type="date" value={orderDate} disabled={!editable} onChange={(e) => setOrderDate(e.target.value)} />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block">سبب التغيير</span>
            <Input value={reason} disabled={!editable} onChange={(e) => setReason(e.target.value)} />
          </label>
        </div>
        {order ? (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
            <div>قيمة العقد الأصلية: {formatEgp(order.originalContractValueSnapshot)}</div>
            <div>زيادة: {formatEgp(order.increaseValue)}</div>
            <div>تخفيض: {formatEgp(order.decreaseValue)}</div>
            <div className="font-semibold text-[#0E78AA]">
              صافي التأثير: {formatEgp(order.netImpact)} — معدّل: {formatEgp(order.revisedContractValueSnapshot)}
            </div>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
        <table className="w-full min-w-[960px] text-center text-sm">
          <thead className="bg-[#0E78AA] text-white">
            <tr>
              <th className="px-2 py-2">نوع التغيير</th>
              <th className="px-2 py-2">البند</th>
              <th className="px-2 py-2">الكمية الأصلية</th>
              <th className="px-2 py-2">التغيير</th>
              <th className="px-2 py-2">بعد التغيير</th>
              <th className="px-2 py-2">السعر الأصلي</th>
              <th className="px-2 py-2">السعر المعتمد</th>
              <th className="px-2 py-2">أثر التغيير</th>
            </tr>
          </thead>
          <tbody>
            {(displayLines ?? []).map((line, idx) => (
              <tr key={line.id ?? idx} className="border-t border-slate-100 even:bg-[#F6FBFD]/40">
                <td className="px-2 py-2">{CHANGE_TYPE_LABEL[line.changeType as ContractVariationChangeType]}</td>
                <td className="px-2 py-2 text-start">
                  <p className="font-semibold">{line.itemCodeSnapshot}</p>
                  <p className="text-xs text-slate-500">{line.descriptionArSnapshot}</p>
                </td>
                <td className="px-2 py-2 tabular-nums">{formatQty(line.originalQuantity)}</td>
                <td className="px-2 py-2 tabular-nums">{formatQty(line.quantityDelta)}</td>
                <td className="px-2 py-2 tabular-nums">
                  {line.effectiveQuantityAfter != null ? formatQty(line.effectiveQuantityAfter) : '—'}
                </td>
                <td className="px-2 py-2 tabular-nums">{formatEgp(line.originalRate)}</td>
                <td className="px-2 py-2 tabular-nums">
                  {line.approvedRate != null ? formatEgp(line.approvedRate) : '—'}
                </td>
                <td className="px-2 py-2 tabular-nums font-semibold">{formatEgp(line.amountImpact)}</td>
              </tr>
            ))}
            {!displayLines?.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                  {editable ? 'أضف أسطر في المسودة ثم احفظ لعرض الأثر المحسوب.' : 'لا توجد أسطر.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editable ? (
        <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3">
          <p className="text-sm font-medium">إضافة سطر (مسودة)</p>
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 md:grid-cols-6">
              <select
                className="rounded-lg border px-2 py-2 text-sm"
                value={line.changeType}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((row, i) =>
                      i === idx ? { ...row, changeType: e.target.value as ContractVariationChangeType } : row
                    )
                  )
                }
              >
                {Object.entries(CHANGE_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              {line.changeType !== 'NEW_ITEM' ? (
                <select
                  className="rounded-lg border px-2 py-2 text-sm md:col-span-2"
                  value={line.projectBOQItemId ?? ''}
                  onChange={(e) => {
                    const boq = boqItems.find((b) => b.id === e.target.value);
                    setLines((prev) =>
                      prev.map((row, i) =>
                        i === idx
                          ? {
                              ...row,
                              projectBOQItemId: e.target.value,
                              itemCodeSnapshot: boq?.itemCode ?? row.itemCodeSnapshot,
                              descriptionArSnapshot: boq?.descriptionAr ?? row.descriptionArSnapshot,
                              unitSnapshot: boq?.unit ?? row.unitSnapshot,
                            }
                          : row
                      )
                    );
                  }}
                >
                  <option value="">— بند —</option>
                  {boqItems.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.itemCode}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <Input
                    placeholder="كود"
                    value={line.itemCodeSnapshot}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, itemCodeSnapshot: e.target.value } : row))
                      )
                    }
                  />
                  <Input
                    placeholder="الوصف"
                    value={line.descriptionArSnapshot}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, descriptionArSnapshot: e.target.value } : row))
                      )
                    }
                  />
                </>
              )}
              {(line.changeType === 'QUANTITY_CHANGE' || line.changeType === 'OMIT') && (
                <Input
                  type="number"
                  placeholder="Δ كمية"
                  value={line.quantityDelta || ''}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, quantityDelta: toMoney(e.target.value) } : row))
                    )
                  }
                />
              )}
              {(line.changeType === 'RATE_CHANGE' || line.changeType === 'NEW_ITEM') && (
                <Input
                  type="number"
                  placeholder="سعر معتمد"
                  value={line.approvedRate ?? ''}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, approvedRate: toMoney(e.target.value) } : row))
                    )
                  }
                />
              )}
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={addLine}>
            + سطر
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {editable ? (
          <Button isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            حفظ مسودة
          </Button>
        ) : null}
        {editable && variationOrderId ? (
          <Button variant="secondary" isLoading={submitM.isPending} onClick={() => submitM.mutate()}>
            إرسال للمراجعة
          </Button>
        ) : null}
        {status === 'SUBMITTED' ? (
          <>
            <Button isLoading={reviewM.isPending} onClick={() => reviewM.mutate()}>
              بدء المراجعة
            </Button>
            <Button variant="secondary" isLoading={approveM.isPending} onClick={() => approveM.mutate()}>
              اعتماد
            </Button>
          </>
        ) : null}
        {status === 'UNDER_REVIEW' ? (
          <Button isLoading={approveM.isPending} onClick={() => approveM.mutate()}>
            اعتماد
          </Button>
        ) : null}
        {(status === 'SUBMITTED' || status === 'UNDER_REVIEW') && (
          <>
            <Input placeholder="سبب الرفض" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <Button
              variant="secondary"
              disabled={rejectReason.trim().length < 3}
              isLoading={rejectM.isPending}
              onClick={() => rejectM.mutate()}
            >
              رفض
            </Button>
          </>
        )}
        {status === 'APPROVED' && (
          <>
            <Input placeholder="سبب الإلغاء" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <Button
              variant="secondary"
              disabled={cancelReason.trim().length < 3}
              isLoading={cancelM.isPending}
              onClick={() => cancelM.mutate()}
            >
              إلغاء أمر معتمد
            </Button>
          </>
        )}
        <Link href={`/contracting/projects/${projectId}/variation-orders`}>
          <Button variant="secondary">القائمة</Button>
        </Link>
      </div>
    </div>
  );
}
