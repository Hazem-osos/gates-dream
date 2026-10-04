'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { PreliminaryStatusBadge } from '@/components/contracting/preliminary/PreliminaryStatusBadge';
import { PreliminaryStatusStepper } from '@/components/contracting/preliminary/PreliminaryStatusStepper';
import { OwnerPreliminaryBoqTable } from '@/components/contracting/preliminary/OwnerPreliminaryBoqTable';
import { OwnerPreliminaryMeasurementPanel } from '@/components/contracting/preliminary/OwnerPreliminaryMeasurementPanel';
import { OwnerPreliminaryTotalsPanel } from '@/components/contracting/preliminary/OwnerPreliminaryTotalsPanel';
import { ProjectCard } from '@/components/contracting/ContractingProjectPageShell';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { translatePreliminaryError } from '@/lib/contracting/preliminary-errors';
import type {
  ConvertPreliminaryResult,
  OwnerPreliminaryCertificate,
  OwnerPreliminaryLine,
} from '@/lib/contracting/preliminary-types';
import type { ClientContractDetail, OwnerBoqItem } from '@/lib/contracting/types';
import type { ContractBoqScope } from '@/lib/contracting/variation-types';
import { toast } from '@/lib/feedback/toast';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { toDateInput, toMoney } from '@/lib/subcontracts/money';

type LineDraft = { projectBOQItemId: string; requestedCurrentQuantity: number };

export function OwnerPreliminaryWorkspace({
  projectId,
  contractId,
  certificateId,
}: {
  projectId: string;
  contractId: string;
  certificateId?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const convertKeyRef = useRef<string | null>(null);

  const boqQ = useApiQuery<OwnerBoqItem[]>(
    queryKeys.contracting.ownerBoq(projectId),
    `/contracting/technical-office/projects/${projectId}/boq`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const contractQ = useApiQuery<ClientContractDetail | null>(
    queryKeys.contracting.clientContract(projectId),
    `/contracting/client-billing/projects/${projectId}/contract`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const boqItems = boqQ.data?.data ?? [];

  const scopeQ = useQuery({
    queryKey: ['contract-boq-scope', contractId],
    queryFn: async () => {
      const res = await apiClient.get<ContractBoqScope>(
        `/contracting/client-billing/contracts/${contractId}/boq-scope`
      );
      return res.data!;
    },
  });
  const scopeByBoq = useMemo(() => {
    const map = new Map<string, ContractBoqScope['items'][number]>();
    for (const row of scopeQ.data?.items ?? []) map.set(row.projectBOQItemId, row);
    return map;
  }, [scopeQ.data?.items]);

  const certQuery = useQuery({
    queryKey: ['owner-prelim-detail', contractId, certificateId],
    enabled: Boolean(certificateId),
    queryFn: async () => {
      const res = await apiClient.get<OwnerPreliminaryCertificate>(
        `/contracting/client-billing/contracts/${contractId}/preliminary-certificates/${certificateId}`
      );
      return res.data!;
    },
  });

  const cert = certQuery.data;
  const status = cert?.status ?? 'DRAFT';

  const [periodStart, setPeriodStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [penalties, setPenalties] = useState('0');
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([]);
  const [requestedByBoq, setRequestedByBoq] = useState<Record<string, number>>({});
  const [approvedByBoq, setApprovedByBoq] = useState<Record<string, number>>({});
  const [selectedMeasurements, setSelectedMeasurements] = useState<
    Array<{ executiveMeasurementSheetId: string; consumedQuantity: number }>
  >([]);
  const [rejectReason, setRejectReason] = useState('');
  const [convertInfo, setConvertInfo] = useState<{ invoiceId: string; replay: boolean } | null>(null);

  const syncFromCert = useCallback((row: OwnerPreliminaryCertificate) => {
    setPeriodStart(toDateInput(row.periodStartDate));
    setPeriodEnd(toDateInput(row.periodEndDate));
    setPenalties(String(toMoney(row.otherClientPenalties)));
    const drafts: LineDraft[] = row.lines.map((l) => ({
      projectBOQItemId: l.projectBOQItemId,
      requestedCurrentQuantity: toMoney(l.requestedCurrentQuantity),
    }));
    setLineDrafts(drafts);
    const req: Record<string, number> = {};
    const app: Record<string, number> = {};
    for (const l of row.lines) {
      req[l.projectBOQItemId] = toMoney(l.requestedCurrentQuantity);
      app[l.projectBOQItemId] =
        l.approvedCurrentQuantity != null ? toMoney(l.approvedCurrentQuantity) : toMoney(l.requestedCurrentQuantity);
    }
    setRequestedByBoq(req);
    setApprovedByBoq(app);
    setSelectedMeasurements(
      (row.measurements ?? []).map((m) => ({
        executiveMeasurementSheetId: m.executiveMeasurementSheetId,
        consumedQuantity: toMoney(m.consumedQuantity),
      }))
    );
  }, []);

  useEffect(() => {
    if (cert) syncFromCert(cert);
  }, [cert, syncFromCert]);

  const displayLines: OwnerPreliminaryLine[] = useMemo(() => {
    const enrich = (line: OwnerPreliminaryLine): OwnerPreliminaryLine => {
      const scope = scopeByBoq.get(line.projectBOQItemId);
      const boq = boqItems.find((b) => b.id === line.projectBOQItemId);
      const original = scope?.originalQuantity ?? toMoney(boq?.contractQuantity);
      const effective = toMoney(line.contractQuantitySnapshot);
      const delta =
        scope?.approvedVariationQuantityDelta ??
        (effective !== original ? effective - original : undefined);
      return {
        ...line,
        originalContractQuantity: original,
        approvedVariationQuantityDelta: delta !== 0 && delta != null ? delta : undefined,
      };
    };
    if (cert?.lines?.length) return cert.lines.map(enrich);
    return lineDrafts.map((d, idx) => {
      const boq = boqItems.find((b) => b.id === d.projectBOQItemId);
      const scope = scopeByBoq.get(d.projectBOQItemId);
      const original = scope?.originalQuantity ?? toMoney(boq?.contractQuantity);
      const effective = scope?.effectiveQuantity ?? toMoney(boq?.contractQuantity);
      const delta =
        scope?.approvedVariationQuantityDelta ??
        (effective !== original ? effective - original : undefined);
      const rate = scope?.effectiveRate ?? toMoney(boq?.unitSellingPrice);
      return {
        id: `draft-${idx}`,
        projectBOQItemId: d.projectBOQItemId,
        itemCodeSnapshot: boq?.itemCode ?? '—',
        descriptionArSnapshot: boq?.descriptionAr ?? '',
        unitSnapshot: boq?.unit ?? '',
        contractQuantitySnapshot: effective,
        originalContractQuantity: original,
        approvedVariationQuantityDelta: delta !== 0 && delta != null ? delta : undefined,
        previousCertifiedQuantity: 0,
        requestedCurrentQuantity: d.requestedCurrentQuantity,
        approvedCurrentQuantity: null,
        cumulativeApprovedQuantity: d.requestedCurrentQuantity,
        remainingQuantity: Math.max(0, effective - d.requestedCurrentQuantity),
        unitRateSnapshot: rate,
        currentAmount: d.requestedCurrentQuantity * rate,
        cumulativeAmount: d.requestedCurrentQuantity * rate,
      };
    });
  }, [cert?.lines, lineDrafts, boqItems, scopeByBoq]);

  const availableBoq = boqItems.filter((b) => !lineDrafts.some((l) => l.projectBOQItemId === b.id));

  const savePayload = () => ({
    certificateId: certificateId,
    periodStartDate: periodStart,
    periodEndDate: periodEnd,
    otherClientPenalties: toMoney(penalties),
    lines: lineDrafts.map((l) => ({
      projectBOQItemId: l.projectBOQItemId,
      requestedCurrentQuantity: requestedByBoq[l.projectBOQItemId] ?? l.requestedCurrentQuantity,
    })),
    measurementSheetIds: selectedMeasurements.length ? selectedMeasurements : undefined,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['owner-preliminary', contractId] });
    if (certificateId) {
      void queryClient.invalidateQueries({ queryKey: ['owner-prelim-detail', contractId, certificateId] });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!lineDrafts.length) throw new Error('أضف بنداً واحداً على الأقل');
      return apiClient.post<OwnerPreliminaryCertificate>(
        `/contracting/client-billing/contracts/${contractId}/preliminary-certificates`,
        savePayload()
      );
    },
    onSuccess: (res) => {
      notifyApiSuccess('تم حفظ المسودة');
      const id = res.data?.id;
      if (!certificateId && id) {
        router.replace(`/contracting/projects/${projectId}/preliminary-certificates/${id}`);
      } else {
        invalidate();
      }
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });

  const submitMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch<OwnerPreliminaryCertificate>(
        `/contracting/client-billing/contracts/${contractId}/preliminary-certificates/${certificateId}/submit`,
        {}
      ),
    onSuccess: () => {
      notifyApiSuccess('تم إرسال المستخلص للمراجعة');
      invalidate();
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });

  const reviewMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch<OwnerPreliminaryCertificate>(
        `/contracting/client-billing/contracts/${contractId}/preliminary-certificates/${certificateId}/begin-review`,
        {}
      ),
    onSuccess: () => {
      notifyApiSuccess('المستخلص تحت المراجعة');
      invalidate();
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });
  const approveMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch<OwnerPreliminaryCertificate>(
        `/contracting/client-billing/contracts/${contractId}/preliminary-certificates/${certificateId}/approve`,
        {
          lines: (cert?.lines ?? displayLines).map((l) => ({
            projectBOQItemId: l.projectBOQItemId,
            approvedCurrentQuantity: approvedByBoq[l.projectBOQItemId] ?? toMoney(l.requestedCurrentQuantity),
          })),
        }
      ),
    onSuccess: () => {
      notifyApiSuccess('تم اعتماد المستخلص');
      invalidate();
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch<OwnerPreliminaryCertificate>(
        `/contracting/client-billing/contracts/${contractId}/preliminary-certificates/${certificateId}/reject`,
        { reason: rejectReason.trim() }
      ),
    onSuccess: () => {
      notifyApiSuccess('تم رفض المستخلص');
      invalidate();
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!convertKeyRef.current) convertKeyRef.current = crypto.randomUUID();
      return apiClient.post<ConvertPreliminaryResult>(
        `/contracting/client-billing/contracts/${contractId}/preliminary-certificates/${certificateId}/convert`,
        { idempotencyKey: convertKeyRef.current }
      );
    },
    onSuccess: (res) => {
      const invoiceId = res.data?.clientInvoiceId;
      if (invoiceId) {
        setConvertInfo({ invoiceId, replay: Boolean(res.data?.replay) });
        notifyApiSuccess(res.data?.replay ? 'المستخلص المالي موجود مسبقاً' : 'تم التحويل إلى مسودة مستخلص مالي');
      }
      invalidate();
      void queryClient.invalidateQueries({ queryKey: queryKeys.contracting.clientContract(projectId) });
    },
    onError: (err) => toast.error(translatePreliminaryError(err)),
  });

  const addBoqLine = (boqId: string) => {
    if (!boqId) return;
    setLineDrafts((prev) => [...prev, { projectBOQItemId: boqId, requestedCurrentQuantity: 0 }]);
    setRequestedByBoq((prev) => ({ ...prev, [boqId]: 0 }));
  };

  const toggleMeasurement = (sheetId: string, netQty: number, on: boolean) => {
    setSelectedMeasurements((prev) => {
      if (!on) return prev.filter((r) => r.executiveMeasurementSheetId !== sheetId);
      if (prev.some((r) => r.executiveMeasurementSheetId === sheetId)) return prev;
      return [...prev, { executiveMeasurementSheetId: sheetId, consumedQuantity: netQty }];
    });
  };

  const confirmConvert = () => {
    if (!window.confirm('تحويل المستخلص المعتمد إلى مسودة مستخلص مالي؟ لن يتم الترحيل المحاسبي تلقائياً.')) {
      return;
    }
    convertMutation.mutate();
  };

  if (certificateId && certQuery.isLoading) {
    return <TableSkeleton rows={6} columns={4} />;
  }
  if (certificateId && certQuery.isError) {
    return <EmptyState title="تعذر تحميل المستخلص" />;
  }

  const editableDraft = status === 'DRAFT';
  const review = status === 'SUBMITTED' || status === 'UNDER_REVIEW';
  const invoiceId = convertInfo?.invoiceId ?? cert?.clientInvoiceId;
  const financialInvoiceNumber =
    contractQ.data?.data?.invoices?.find((inv) => inv.id === invoiceId)?.invoiceNumber ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <ProjectCard title={cert ? cert.certificateNumber : 'مستخلص ابتدائي جديد'}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {cert ? <PreliminaryStatusBadge status={cert.status} /> : <PreliminaryStatusBadge status="DRAFT" />}
            {cert?.rejectionReason ? (
              <span className="text-xs text-red-700">سبب الرفض: {cert.rejectionReason}</span>
            ) : null}
          </div>
          {cert ? <PreliminaryStatusStepper status={cert.status} /> : <PreliminaryStatusStepper status="DRAFT" />}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium">بداية الفترة</span>
              <Input
                type="date"
                value={periodStart}
                disabled={!editableDraft}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">نهاية الفترة</span>
              <Input
                type="date"
                value={periodEnd}
                disabled={!editableDraft}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </label>
          </div>

          {editableDraft ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-sm">
                <span className="mb-1 block">إضافة بند BOQ</span>
                <select
                  className="min-w-[220px] rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    addBoqLine(e.target.value);
                    e.target.value = '';
                  }}
                >
                  <option value="">— اختر البند —</option>
                  {availableBoq.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.itemCode} — {b.descriptionAr}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block">غرامات العميل (اختياري)</span>
                <Input type="number" min={0} value={penalties} onChange={(e) => setPenalties(e.target.value)} />
              </label>
            </div>
          ) : null}
        </ProjectCard>

        <ProjectCard title="جدول BOQ">
          <OwnerPreliminaryBoqTable
            lines={displayLines}
            status={status}
            requestedByBoq={requestedByBoq}
            approvedByBoq={approvedByBoq}
            onRequestedChange={
              editableDraft
                ? (id, qty) => {
                    setRequestedByBoq((p) => ({ ...p, [id]: qty }));
                    setLineDrafts((prev) =>
                      prev.map((l) => (l.projectBOQItemId === id ? { ...l, requestedCurrentQuantity: qty } : l))
                    );
                  }
                : undefined
            }
            onApprovedChange={
              review
                ? (id, qty) => setApprovedByBoq((p) => ({ ...p, [id]: qty }))
                : undefined
            }
          />
        </ProjectCard>

        {editableDraft ? (
          <ProjectCard title="دفاتر الحصر">
            <OwnerPreliminaryMeasurementPanel
              contractId={contractId}
              certificateId={certificateId}
              boqItems={boqItems}
              lineBoqIds={lineDrafts.map((l) => l.projectBOQItemId)}
              linked={cert?.measurements ?? []}
              selectedIds={selectedMeasurements.map((m) => m.executiveMeasurementSheetId)}
              editable
              onToggle={toggleMeasurement}
            />
          </ProjectCard>
        ) : null}

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
                اعتماد مباشر
              </Button>
            </>
          ) : null}
          {status === 'UNDER_REVIEW' ? (
            <Button isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
              اعتماد
            </Button>
          ) : null}
          {(status === 'SUBMITTED' || status === 'UNDER_REVIEW') && (
            <div className="flex flex-wrap items-end gap-2">
              <Input
                placeholder="سبب الرفض"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-w-[200px]"
              />
              <Button
                variant="secondary"
                isLoading={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
                disabled={rejectReason.trim().length < 3}
              >
                رفض
              </Button>
            </div>
          )}
          {status === 'APPROVED' ? (
            <Button isLoading={convertMutation.isPending} onClick={confirmConvert}>
              تحويل إلى مستخلص مالي
            </Button>
          ) : null}
          {financialInvoiceNumber ? (
            <p className="w-full text-sm text-emerald-800">
              المستخلص المالي: <strong>{financialInvoiceNumber}</strong>
            </p>
          ) : null}
          {invoiceId ? (
            <Link href={`/contracting/projects/${projectId}/client-billing?invoiceId=${invoiceId}`}>
              <Button variant="secondary">فتح المستخلص المالي</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {cert ? <OwnerPreliminaryTotalsPanel cert={cert} /> : null}
    </div>
  );
}
