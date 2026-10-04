'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/Switch';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { PreliminaryStatusBadge } from '@/components/contracting/preliminary/PreliminaryStatusBadge';
import { PreliminaryStatusStepper } from '@/components/contracting/preliminary/PreliminaryStatusStepper';
import { SubPreliminaryBoqTable } from '@/components/contracting/preliminary/SubPreliminaryBoqTable';
import { SubPreliminaryTotalsPanel } from '@/components/contracting/preliminary/SubPreliminaryTotalsPanel';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { translatePreliminaryError } from '@/lib/contracting/preliminary-errors';
import type {
  ConvertPreliminaryResult,
  SubPreliminaryCertificate,
  SubPreliminaryLine,
} from '@/lib/contracting/preliminary-types';
import { toast } from '@/lib/feedback/toast';
import { queryKeys } from '@/lib/query/query-keys';
import { toDateInput, toMoney } from '@/lib/subcontracts/money';
import type { SubcontractDetail } from '@/lib/subcontracts/types';

type LineDraft = { subcontractBOQItemId: string; requestedCurrentQuantity: number };

export function SubPreliminaryWorkspace({
  subcontract,
  certificateId,
}: {
  subcontract: SubcontractDetail;
  certificateId?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const convertKeyRef = useRef<string | null>(null);
  const subcontractId = subcontract.id;

  const certQuery = useQuery({
    queryKey: ['sub-prelim-detail', subcontractId, certificateId],
    enabled: Boolean(certificateId),
    queryFn: async () => {
      const res = await apiClient.get<SubPreliminaryCertificate>(
        `/subcontracts/${subcontractId}/preliminary-certificates/${certificateId}`
      );
      return res.data!;
    },
  });

  const cert = certQuery.data;
  const status = cert?.status ?? 'DRAFT';
  const boqItems = subcontract.boqItems ?? [];

  const [periodStart, setPeriodStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [earlyPay, setEarlyPay] = useState(false);
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([]);
  const [requestedByBoq, setRequestedByBoq] = useState<Record<string, number>>({});
  const [approvedByBoq, setApprovedByBoq] = useState<Record<string, number>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [convertInvoiceId, setConvertInvoiceId] = useState<string | null>(null);

  const syncFromCert = useCallback((row: SubPreliminaryCertificate) => {
    setPeriodStart(toDateInput(row.periodStartDate));
    setPeriodEnd(toDateInput(row.periodEndDate));
    setEarlyPay(toMoney(row.earlyPaymentDiscountDeduction) > 0);
    setLineDrafts(
      row.lines.map((l) => ({
        subcontractBOQItemId: l.subcontractBOQItemId,
        requestedCurrentQuantity: toMoney(l.requestedCurrentQuantity),
      }))
    );
    const req: Record<string, number> = {};
    const app: Record<string, number> = {};
    for (const l of row.lines) {
      req[l.subcontractBOQItemId] = toMoney(l.requestedCurrentQuantity);
      app[l.subcontractBOQItemId] =
        l.approvedCurrentQuantity != null ? toMoney(l.approvedCurrentQuantity) : toMoney(l.requestedCurrentQuantity);
    }
    setRequestedByBoq(req);
    setApprovedByBoq(app);
  }, []);

  useEffect(() => {
    if (cert) syncFromCert(cert);
  }, [cert, syncFromCert]);

  const displayLines: SubPreliminaryLine[] = useMemo(() => {
    if (cert?.lines?.length) return cert.lines;
    return lineDrafts.map((d, idx) => {
      const boq = boqItems.find((b) => b.id === d.subcontractBOQItemId);
      return {
        id: `draft-${idx}`,
        subcontractBOQItemId: d.subcontractBOQItemId,
        itemCodeSnapshot: boq?.itemCode ?? '—',
        descriptionArSnapshot: boq?.descriptionAr ?? '',
        unitSnapshot: boq?.unit ?? '',
        contractQuantitySnapshot: toMoney(boq?.contractQuantity),
        previousCertifiedQuantity: 0,
        requestedCurrentQuantity: d.requestedCurrentQuantity,
        approvedCurrentQuantity: null,
        cumulativeApprovedQuantity: d.requestedCurrentQuantity,
        remainingQuantity: Math.max(0, toMoney(boq?.contractQuantity) - d.requestedCurrentQuantity),
        unitRateSnapshot: toMoney(boq?.unitPrice),
        currentAmount: d.requestedCurrentQuantity * toMoney(boq?.unitPrice),
        cumulativeAmount: d.requestedCurrentQuantity * toMoney(boq?.unitPrice),
      };
    });
  }, [cert?.lines, lineDrafts, boqItems]);

  const availableBoq = boqItems.filter((b) => !lineDrafts.some((l) => l.subcontractBOQItemId === b.id));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['sub-preliminary', subcontractId] });
    if (certificateId) {
      void queryClient.invalidateQueries({ queryKey: ['sub-prelim-detail', subcontractId, certificateId] });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!lineDrafts.length) throw new Error('أضف بنداً واحداً على الأقل');
      return apiClient.post<SubPreliminaryCertificate>(
        `/subcontracts/${subcontractId}/preliminary-certificates`,
        {
          certificateId,
          periodStartDate: periodStart,
          periodEndDate: periodEnd,
          applyEarlyPaymentDiscount: earlyPay,
          lines: lineDrafts.map((l) => ({
            subcontractBOQItemId: l.subcontractBOQItemId,
            requestedCurrentQuantity: requestedByBoq[l.subcontractBOQItemId] ?? l.requestedCurrentQuantity,
          })),
        }
      );
    },
    onSuccess: (res) => {
      notifyApiSuccess('تم حفظ المسودة');
      const id = res.data?.id;
      if (!certificateId && id) {
        router.replace(`/subcontracts/${subcontractId}/preliminary-certificates/${id}`);
      } else {
        invalidate();
      }
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });

  const submitMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/subcontracts/${subcontractId}/preliminary-certificates/${certificateId}/submit`, {}),
    onSuccess: () => {
      notifyApiSuccess('تم الإرسال للمراجعة');
      invalidate();
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });

  const reviewMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/subcontracts/${subcontractId}/preliminary-certificates/${certificateId}/begin-review`, {}),
    onSuccess: () => {
      notifyApiSuccess('تحت المراجعة');
      invalidate();
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });

  const approveMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch<SubPreliminaryCertificate>(
        `/subcontracts/${subcontractId}/preliminary-certificates/${certificateId}/approve`,
        {
          lines: (cert?.lines ?? displayLines).map((l) => ({
            subcontractBOQItemId: l.subcontractBOQItemId,
            approvedCurrentQuantity:
              approvedByBoq[l.subcontractBOQItemId] ?? toMoney(l.requestedCurrentQuantity),
          })),
        }
      ),
    onSuccess: () => {
      notifyApiSuccess('تم الاعتماد');
      invalidate();
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/subcontracts/${subcontractId}/preliminary-certificates/${certificateId}/reject`, {
        reason: rejectReason.trim(),
      }),
    onSuccess: () => {
      notifyApiSuccess('تم الرفض');
      invalidate();
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!convertKeyRef.current) convertKeyRef.current = crypto.randomUUID();
      return apiClient.post<ConvertPreliminaryResult>(
        `/subcontracts/${subcontractId}/preliminary-certificates/${certificateId}/convert`,
        { idempotencyKey: convertKeyRef.current }
      );
    },
    onSuccess: (res) => {
      const id = res.data?.subcontractInvoiceId;
      if (id) {
        setConvertInvoiceId(id);
        notifyApiSuccess(res.data?.replay ? 'مستخلص المقاول موجود مسبقاً' : 'تم التحويل');
      }
      invalidate();
      void queryClient.invalidateQueries({ queryKey: queryKeys.subcontracts.detail(subcontractId) });
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });

  const addBoqLine = (boqId: string) => {
    if (!boqId) return;
    setLineDrafts((prev) => [...prev, { subcontractBOQItemId: boqId, requestedCurrentQuantity: 0 }]);
    setRequestedByBoq((prev) => ({ ...prev, [boqId]: 0 }));
  };

  if (certificateId && certQuery.isLoading) return <TableSkeleton rows={6} columns={4} />;
  if (certificateId && certQuery.isError) return <EmptyState title="تعذر تحميل المستخلص" />;

  const editableDraft = status === 'DRAFT';
  const review = status === 'SUBMITTED' || status === 'UNDER_REVIEW';
  const invoiceId = convertInvoiceId ?? cert?.subcontractInvoiceId;
  const financialInvoiceNumber =
    subcontract.invoices?.find((inv) => inv.id === invoiceId)?.invoiceNumber ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-[#094C6B]">
            {cert ? cert.certificateNumber : 'مستخلص ابتدائي جديد'}
          </h2>
          <PreliminaryStatusBadge status={status} />
        </div>
        <PreliminaryStatusStepper status={status} />

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">بداية الفترة</span>
            <Input type="date" value={periodStart} disabled={!editableDraft} onChange={(e) => setPeriodStart(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">نهاية الفترة</span>
            <Input type="date" value={periodEnd} disabled={!editableDraft} onChange={(e) => setPeriodEnd(e.target.value)} />
          </label>
        </div>

        {editableDraft ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block">إضافة بند</span>
              <select
                className="min-w-[220px] rounded-lg border border-slate-200 px-2 py-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  addBoqLine(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">— اختر —</option>
                {availableBoq.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.itemCode} — {b.descriptionAr}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={earlyPay} onCheckedChange={setEarlyPay} />
              تطبيق خصم السداد المعجل
            </label>
          </div>
        ) : null}

        <SubPreliminaryBoqTable
          lines={displayLines}
          status={status}
          requestedByBoq={requestedByBoq}
          approvedByBoq={approvedByBoq}
          onRequestedChange={
            editableDraft
              ? (id, qty) => {
                  setRequestedByBoq((p) => ({ ...p, [id]: qty }));
                  setLineDrafts((prev) =>
                    prev.map((l) => (l.subcontractBOQItemId === id ? { ...l, requestedCurrentQuantity: qty } : l))
                  );
                }
              : undefined
          }
          onApprovedChange={review ? (id, qty) => setApprovedByBoq((p) => ({ ...p, [id]: qty })) : undefined}
        />

        <div className="flex flex-wrap gap-2">
          {editableDraft ? (
            <Button isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              حفظ مسودة
            </Button>
          ) : null}
          {editableDraft && certificateId ? (
            <Button variant="secondary" isLoading={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
              إرسال للمراجعة
            </Button>
          ) : null}
          {status === 'SUBMITTED' ? (
            <>
              <Button isLoading={reviewMutation.isPending} onClick={() => reviewMutation.mutate()}>
                بدء المراجعة
              </Button>
              <Button variant="secondary" isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
                اعتماد
              </Button>
            </>
          ) : null}
          {status === 'UNDER_REVIEW' ? (
            <Button isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
              اعتماد
            </Button>
          ) : null}
          {(status === 'SUBMITTED' || status === 'UNDER_REVIEW') && (
            <>
              <Input placeholder="سبب الرفض" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <Button
                variant="secondary"
                disabled={rejectReason.trim().length < 3}
                isLoading={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                رفض
              </Button>
            </>
          )}
          {status === 'APPROVED' ? (
            <Button
              isLoading={convertMutation.isPending}
              onClick={() => {
                if (
                  !window.confirm('تحويل إلى مستخلص مقاول باطن (مسودة)؟ لن يتم الترحيل المحاسبي تلقائياً.')
                ) {
                  return;
                }
                convertMutation.mutate();
              }}
            >
              تحويل إلى مستخلص مقاول باطن
            </Button>
          ) : null}
          {financialInvoiceNumber ? (
            <p className="w-full text-sm text-emerald-800">
              مستخلص المقاول: <strong>{financialInvoiceNumber}</strong>
            </p>
          ) : null}
          {invoiceId ? (
            <Link href={`/subcontracts/${subcontractId}/invoices/${invoiceId}`}>
              <Button variant="secondary">فتح مستخلص المقاول</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {cert ? <SubPreliminaryTotalsPanel cert={cert} /> : null}
    </div>
  );
}
