'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { useManufacturingWorkOrderSerial } from '@/lib/manufacturing/use-manufacturing-work-order-serial';
import {
  Button,
  CompactFormField,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';
import {
  ManufacturingPageChrome,
  MfgEmptyRow,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgThClass,
  mfgTheadClass,
  mfgTrClass,
  mfgTableScrollViewportClass,
} from '@/components/manufacturing/ManufacturingPageChrome';
import { ManufacturingQuantityCheckDialog } from '@/components/manufacturing/ManufacturingQuantityCheckDialog';
import {
  buildLoadedProcessFromBom,
  type BomForProcess,
  type LoadedManufacturingProcess,
} from '@/lib/manufacturing/process-from-bom';
import { stashMfgOperationPrefill } from '@/lib/manufacturing/mfg-operation-prefill';
import {
  bomPlansFromProductionRows,
  buildProductionPlanRows,
  mergePlanningMeta,
  parseWorkOrderPlanningMeta,
  resolveBomForFinishedItem,
  type ProductionPlanRow,
} from '@/lib/manufacturing/work-order-planning';
import { workOrderWarehousesFromMetadata } from '@/lib/manufacturing/hydrate-from-work-order';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui';
import {
  manufacturingWorkOrderStatusLabel,
  workOrderStatusTone,
} from '@/lib/manufacturing/work-order-status';

type BomListItem = {
  id: string;
  name: string;
  finishedItemId?: string;
  finishedItem?: { id: string; arabicName: string; serial?: string | null };
  formMetadata?: { description?: string };
};

type WorkOrderLine = {
  itemId: string;
  plannedQuantity: string | number;
  lineDescription?: string | null;
  item?: { id: string; arabicName: string; serial?: string | null };
};

type WorkOrderDetail = {
  id: string;
  orderNumber: string;
  bomId: string | null;
  status: string;
  description?: string | null;
  workDate: string;
  modelQuantity: string | number;
  processMetadata?: Record<string, unknown> | null;
  salesOrderInvoiceId?: string | null;
  lines: WorkOrderLine[];
  bom?: { id: string; name: string } | null;
  salesOrder?: { id: string; invoiceNumber: string | null } | null;
};

type WorkOrderProgress = {
  percentComplete: number;
  requiredTotal: number;
  completedTotal: number;
  remainingTotal: number;
  inProgressTotal: number;
  canFinish: boolean;
  bomRows: Array<{
    bomId: string;
    bomName: string;
    requiredQuantity: number;
    completedQuantity: number;
    inProgressQuantity: number;
    remainingQuantity: number;
    percentComplete: number;
  }>;
};

type WorkOrderListItem = {
  id: string;
  orderNumber: string;
  description?: string | null;
  updatedAt: string;
  bom?: { name: string } | null;
};

function newRowId() {
  return `bp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyProductionRow(): ProductionPlanRow {
  return {
    id: newRowId(),
    itemId: '',
    itemName: '',
    lineDescription: '',
    modelCount: '1',
    bomId: '',
    bomName: '',
  };
}

function num(v: string | number | null | undefined): number {
  return Number(v ?? 0);
}

export default function ProductionPlanningPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">جاري التحميل…</p>}>
      <ProductionPlanningInner />
    </Suspense>
  );
}

function ProductionPlanningInner() {
  useBackendReachability();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateQuery = useInvalidateQuery();

  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [planRows, setPlanRows] = useState<ProductionPlanRow[]>([]);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [manualWorkDate, setManualWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualLines, setManualLines] = useState<ProductionPlanRow[]>([emptyProductionRow()]);
  const [manualSerial, setManualSerial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const [checkProcess, setCheckProcess] = useState<LoadedManufacturingProcess | null>(null);
  const [showQtyCheck, setShowQtyCheck] = useState(false);
  const loadedIdRef = useRef<string | null>(null);

  const { data: bomsRes } = useApiQuery<BomListItem[]>(
    ['manufacturing-boms'],
    '/manufacturing/boms'
  );
  const boms = bomsRes?.data ?? [];
  const bomById = useMemo(() => new Map(boms.map((b) => [b.id, b])), [boms]);

  useManufacturingWorkOrderSerial({
    enabled: showManualCreate && !workOrderId,
    setSerial: setManualSerial,
  });

  const { data: woRes, isLoading: woLoading } = useApiQuery<WorkOrderDetail>(
    ['manufacturing-work-order', workOrderId],
    `/manufacturing/work-orders/${workOrderId}`,
    undefined,
    { enabled: Boolean(workOrderId) }
  );
  const workOrder = woRes?.data ?? null;
  const planningLocked =
    workOrder?.status === 'COMPLETED' ||
    workOrder?.status === 'CANCELLED' ||
    workOrder?.status === 'CLOSED';

  const { data: progressRes, refetch: refetchProgress } = useApiQuery<WorkOrderProgress>(
    ['manufacturing-work-order-progress', workOrderId],
    `/manufacturing/work-orders/${workOrderId}/progress`,
    undefined,
    { enabled: Boolean(workOrderId) }
  );
  const progress = progressRes?.data ?? null;
  const progressByBomId = useMemo(
    () => new Map((progress?.bomRows ?? []).map((r) => [r.bomId, r])),
    [progress?.bomRows]
  );

  const { data: listRes } = useApiQuery<WorkOrderListItem[]>(
    ['manufacturing-work-orders-list'],
    '/manufacturing/work-orders?limit=80'
  );
  const workOrders = listRes?.data ?? [];

  const saveMutation = useApiMutation<WorkOrderDetail, Record<string, unknown>>(
    workOrderId ? `/manufacturing/work-orders/${workOrderId}` : '/manufacturing/work-orders/__pending',
    'PUT',
    {
      onSuccess: (res) => {
        invalidateQuery(['manufacturing-work-order', workOrderId]);
        void refetchProgress();
        setSuccess('تم حفظ أمر الشغل — تم التأكيد');
        if (res.data) applyWorkOrderToForm(res.data);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر الحفظ'),
    }
  );

  function syncPlanRowsFromWorkOrder(wo: WorkOrderDetail) {
    const meta = parseWorkOrderPlanningMeta(wo.processMetadata ?? null);
    setPlanRows(buildProductionPlanRows(wo.lines, boms, meta));
  }

  function applyWorkOrderToForm(wo: WorkOrderDetail) {
    syncPlanRowsFromWorkOrder(wo);
  }

  useEffect(() => {
    const id = searchParams.get('id')?.trim() || searchParams.get('workOrderId')?.trim();
    if (!id) return;
    setWorkOrderId(id);
  }, [searchParams]);

  const planSyncKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workOrder?.id || loadedIdRef.current === workOrder.id) return;
    loadedIdRef.current = workOrder.id;
    planSyncKeyRef.current = null;
    applyWorkOrderToForm(workOrder);
  }, [workOrder]);

  useEffect(() => {
    if (!workOrder?.id || !boms.length) return;
    const key = `${workOrder.id}:${boms.length}`;
    if (planSyncKeyRef.current === key) return;
    planSyncKeyRef.current = key;
    if (loadedIdRef.current === workOrder.id) {
      syncPlanRowsFromWorkOrder(workOrder);
    }
  }, [workOrder, boms]);

  const canEditLineItems = Boolean(workOrder && !workOrder.salesOrderInvoiceId && !planningLocked);

  const createWorkOrderMutation = useApiMutation<WorkOrderDetail, Record<string, unknown>>(
    '/manufacturing/work-orders',
    'POST',
    {
      onError: (err: ApiError) => setError(err.message || 'تعذر إنشاء أمر الشغل'),
    }
  );

  function buildSavePayload() {
    if (!workOrder) throw new Error('لا يوجد أمر شغل');
    const bomPlans = bomPlansFromProductionRows(planRows);
    const primaryBomId = bomPlans[0]?.bomId ?? workOrder.bomId;
    const processMetadata = mergePlanningMeta(workOrder.processMetadata ?? null, {
      bomPlans,
    });
    return {
      orderNumber: workOrder.orderNumber,
      bomId: primaryBomId,
      salesOrderInvoiceId: workOrder.salesOrderInvoiceId ?? null,
      description: workOrder.description,
      workDate: workOrder.workDate?.slice?.(0, 10) ?? workOrder.workDate,
      modelQuantity: bomPlans[0]?.modelCount ?? (num(workOrder.modelQuantity) || 1),
      status:
        workOrder.status === 'CLOSED'
          ? 'CLOSED'
          : workOrder.status === 'IN_PROGRESS'
            ? 'IN_PROGRESS'
            : workOrder.status === 'COMPLETED'
              ? 'COMPLETED'
              : 'CONFIRMED',
      processMetadata,
      lines: planRows
        .filter((r) => r.itemId)
        .map((row, index) => ({
          itemId: row.itemId,
          plannedQuantity: Math.max(0, Number(row.modelCount) || 0),
          completedQuantity: 0,
          lineDescription: row.lineDescription?.trim() || null,
          lineOrder: index + 1,
        })),
    };
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    if (!workOrderId || !workOrder) {
      setError('افتح أمر شغل من القائمة أو من أمر البيع');
      return;
    }
    if (planRows.some((r) => r.itemId && !r.bomId)) {
      setError('بعض الأصناف بلا نموذج تصنيع — عرّف نموذجاً للصنف التام أولاً');
      return;
    }
    if (
      planRows.some(
        (r) => r.itemId && (!Number.isFinite(Number(r.modelCount)) || Number(r.modelCount) <= 0)
      )
    ) {
      setError('أدخل كمية صحيحة لكل صنف');
      return;
    }
    await saveMutation.mutateAsync(buildSavePayload());
  }

  function patchPlanRow(index: number, patch: Partial<ProductionPlanRow>) {
    setPlanRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function resolveRowBom(itemId: string) {
    const bom = resolveBomForFinishedItem(boms, itemId);
    return {
      bomId: bom?.id ?? '',
      bomName: bom?.name ?? 'لا يوجد نموذج لهذا الصنف',
    };
  }

  async function handleCreateManualWorkOrder() {
    setError(null);
    const lines = manualLines.filter((l) => l.itemId && Number(l.modelCount) > 0);
    if (!lines.length) {
      setError('أضف صنفاً واحداً على الأقل');
      return;
    }
    if (lines.some((l) => !resolveBomForFinishedItem(boms, l.itemId))) {
      setError('بعض الأصناف بلا نموذج تصنيع مرتبط');
      return;
    }
    const bomPlans = bomPlansFromProductionRows(lines);
    const res = await createWorkOrderMutation.mutateAsync({
      orderNumber: manualSerial || undefined,
      description: manualDescription.trim() || 'أمر شغل يدوي',
      workDate: manualWorkDate,
      modelQuantity: bomPlans[0]?.modelCount ?? 1,
      status: 'CONFIRMED',
      processMetadata: { bomPlans },
      lines: lines.map((l, i) => ({
        itemId: l.itemId,
        plannedQuantity: Number(l.modelCount),
        lineDescription: l.lineDescription?.trim() || null,
        lineOrder: i + 1,
      })),
    });
    if (res.data?.id) {
      setShowManualCreate(false);
      openWorkOrder(res.data.id);
      setSuccess('تم إنشاء أمر الشغل');
    }
  }

  async function loadBomProcess(row: ProductionPlanRow): Promise<LoadedManufacturingProcess | null> {
    if (!row.bomId) return null;
    const qty = Number(row.modelCount);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    const res = await apiClient.get<BomForProcess>(`/manufacturing/boms/${row.bomId}`);
    return buildLoadedProcessFromBom(res.data, qty);
  }

  async function handleCheckRow(row: ProductionPlanRow) {
    setError(null);
    if (!row.bomId) {
      setError('لا يوجد نموذج تصنيع مرتبط بهذا الصنف');
      return;
    }
    setBusy(true);
    try {
      const loaded = await loadBomProcess(row);
      if (!loaded?.raws.length) {
        setError('لا توجد خامات لهذا النموذج والكمية');
        return;
      }
      setCheckProcess(loaded);
      setShowQtyCheck(true);
    } catch (err) {
      setError((err as ApiError).message || 'تعذر فحص الكميات');
    } finally {
      setBusy(false);
    }
  }

  async function handleManufacture(row: ProductionPlanRow) {
    setError(null);
    if (!workOrderId || !workOrder) {
      setError('افتح أمر شغل مرتبط');
      return;
    }
    if (!row.bomId) {
      setError('لا يوجد نموذج تصنيع لهذا الصنف');
      return;
    }
    const qty = Number(row.modelCount);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('كمية النموذج غير صالحة');
      return;
    }
    setBusy(true);
    try {
      const loaded = await loadBomProcess(row);
      const wh = workOrderWarehousesFromMetadata({
        processMetadata: workOrder.processMetadata,
        id: workOrder.id,
        orderNumber: workOrder.orderNumber,
        bomId: workOrder.bomId,
        modelQuantity: workOrder.modelQuantity,
      });
      stashMfgOperationPrefill({
        bomId: row.bomId,
        manufacturingWorkOrderId: workOrderId,
        fromWarehouseId: loaded?.fromWarehouseId || wh.fromWarehouseId,
        toWarehouseId: loaded?.toWarehouseId || wh.toWarehouseId,
        stage: loaded?.stage || wh.stage,
        costCenter: loaded?.costCenter || wh.costCenter,
        numberOfModels: qty,
        description: workOrder.description?.trim() || `تصنيع من أمر شغل ${workOrder.orderNumber}`,
        autoLoad: true,
      });
      router.push(
        `/manufacturing/operations/operation?workOrderId=${encodeURIComponent(workOrderId)}&bomId=${encodeURIComponent(row.bomId)}&modelCount=${encodeURIComponent(String(qty))}`
      );
    } catch (err) {
      setError((err as ApiError).message || 'تعذر فتح أمر التصنيع');
    } finally {
      setBusy(false);
    }
  }

  const finishMutation = useApiMutation<WorkOrderDetail, Record<string, never>>(
    workOrderId ? `/manufacturing/work-orders/${workOrderId}/finish` : '/manufacturing/work-orders/__pending/finish',
    'POST',
    {
      onSuccess: (res) => {
        invalidateQuery(['manufacturing-work-order', workOrderId]);
        void refetchProgress();
        setSuccess('تم إنهاء أمر الشغل');
        if (res.data) applyWorkOrderToForm(res.data);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إنهاء أمر الشغل'),
    }
  );

  async function handleFinish() {
    setError(null);
    if (!workOrderId) return;
    if (!progress?.canFinish) {
      setError('أكمل كل كميات النماذج في أوامر التصنيع أولاً');
      return;
    }
    await finishMutation.mutateAsync({});
  }

  function openWorkOrder(id: string) {
    setShowBrowse(false);
    loadedIdRef.current = null;
    setWorkOrderId(id);
    setError(null);
    setSuccess(null);
    router.replace(`/manufacturing/operations/production-planning?id=${encodeURIComponent(id)}`);
  }

  const planningMeta = parseWorkOrderPlanningMeta(workOrder?.processMetadata ?? null);
  const salesOrderId =
    workOrder?.salesOrderInvoiceId ||
    planningMeta.salesOrderInvoiceId ||
    workOrder?.salesOrder?.id;

  return (
    <ManufacturingPageChrome
      title="أمر الشغل"
      docNumber={workOrder?.orderNumber}
      currentId={workOrderId}
      favoriteHref="/manufacturing/operations/production-planning"
      onSave={() => void handleSave()}
      savePending={saveMutation.isPending || busy}
      canSave={Boolean(workOrder)}
      saveLabel="حفظ أمر الشغل"
      onBrowseList={() => setShowBrowse(true)}
      browseListLabel="أوامر الشغل"
      statusLabel={workOrder ? manufacturingWorkOrderStatusLabel(workOrder.status) : 'جديد'}
      statusTone={workOrder ? workOrderStatusTone(workOrder.status) : 'info'}
      extraActions={
        workOrder && !planningLocked ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!progress?.canFinish || finishMutation.isPending || busy}
            onClick={() => void handleFinish()}
          >
            إنتهاء
          </Button>
        ) : null
      }
    >
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}
      {!workOrderId ? (
        <FormSectionCard title="أمر الشغل">
          <p className="text-sm text-slate-600">
            من أمر البيع: «إنشاء أمر شغل» ثم افتحه هنا. أو أنشئ أمر شغل يدوياً بدون أمر بيع.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setShowBrowse(true)}>
              اختيار أمر شغل
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setShowManualCreate((v) => !v);
                setError(null);
              }}
            >
              أمر شغل يدوي
            </Button>
          </div>
          {showManualCreate ? (
            <div className="mt-4 space-y-3 rounded-xl border border-[#D6EAF3] bg-[#F8FBFD] p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CompactFormField label="رقم الأمر">
                  <input className={compactControlClass} value={manualSerial} readOnly />
                </CompactFormField>
                <CompactFormField label="تاريخ الأمر">
                  <input
                    type="date"
                    className={compactControlClass}
                    value={manualWorkDate}
                    onChange={(e) => setManualWorkDate(e.target.value)}
                  />
                </CompactFormField>
                <CompactFormField label="الشرح" className="sm:col-span-2">
                  <input
                    className={compactControlClass}
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    placeholder="وصف أمر الشغل"
                  />
                </CompactFormField>
              </div>
              <table className={mfgTableClass}>
                <thead className={mfgTheadClass}>
                  <tr>
                    <th className={mfgThClass}>الصنف</th>
                    <th className={mfgThClass}>الكمية المطلوبة</th>
                    <th className={mfgThClass}>المواصفات</th>
                    <th className={mfgThClass}>نموذج التصنيع</th>
                    <th className={mfgThClass} />
                  </tr>
                </thead>
                <tbody>
                  {manualLines.map((row, index) => {
                    const bom = row.itemId ? resolveRowBom(row.itemId) : { bomId: '', bomName: '' };
                    return (
                      <tr key={row.id} className={mfgTrClass}>
                        <td className={mfgTdClass}>
                          <ItemSelect
                            value={row.itemId}
                            onChange={(id) => {
                              const b = resolveRowBom(id);
                              setManualLines((prev) =>
                                prev.map((r, i) =>
                                  i === index
                                    ? {
                                        ...r,
                                        itemId: id,
                                        bomId: b.bomId,
                                        bomName: b.bomName,
                                      }
                                    : r
                                )
                              );
                            }}
                            onItemResolved={(item) => {
                              if (!item) return;
                              const b = resolveRowBom(item.id);
                              setManualLines((prev) =>
                                prev.map((r, i) =>
                                  i === index
                                    ? {
                                        ...r,
                                        itemId: item.id,
                                        itemName: item.arabicName,
                                        bomId: b.bomId,
                                        bomName: b.bomName,
                                      }
                                    : r
                                )
                              );
                            }}
                          />
                        </td>
                        <td className={mfgTdClass}>
                          <input
                            type="number"
                            min={0}
                            className={compactControlClass}
                            value={row.modelCount}
                            onChange={(e) =>
                              setManualLines((prev) =>
                                prev.map((r, i) =>
                                  i === index ? { ...r, modelCount: e.target.value } : r
                                )
                              )
                            }
                          />
                        </td>
                        <td className={mfgTdClass}>
                          <input
                            className={compactControlClass}
                            value={row.lineDescription}
                            onChange={(e) =>
                              setManualLines((prev) =>
                                prev.map((r, i) =>
                                  i === index ? { ...r, lineDescription: e.target.value } : r
                                )
                              )
                            }
                          />
                        </td>
                        <td className={mfgTdClass}>
                          <span className="text-xs text-slate-600">
                            {row.itemId ? bom.bomName : '—'}
                          </span>
                        </td>
                        <td className={mfgTdClass}>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={manualLines.length <= 1}
                            onClick={() =>
                              setManualLines((prev) => prev.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setManualLines((prev) => [...prev, emptyProductionRow()])}
                >
                  <Plus className="ms-1 h-4 w-4" />
                  إضافة صنف
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#0E78AA] hover:bg-[#0B6188]"
                  disabled={createWorkOrderMutation.isPending || busy}
                  onClick={() => void handleCreateManualWorkOrder()}
                >
                  حفظ أمر الشغل
                </Button>
              </div>
            </div>
          ) : null}
        </FormSectionCard>
      ) : woLoading && !workOrder ? (
        <p className="text-sm text-slate-500">جاري تحميل أمر الشغل…</p>
      ) : !workOrder ? (
        <p className="text-sm text-rose-600">تعذر تحميل أمر الشغل</p>
      ) : (
        <>
          <FormSectionCard title="بيانات أمر الشغل">
            {progress ? (
              <div className="mb-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge
                    tone={workOrderStatusTone(workOrder.status)}
                    label={manufacturingWorkOrderStatusLabel(workOrder.status)}
                  />
                  <span className="text-sm font-bold text-[#0A3D5E]">
                    التقدم الكلي: {progress.percentComplete.toLocaleString('ar-EG')}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#E6F0F7]">
                  <div
                    className="h-full rounded-full bg-[#0E78AA] transition-all"
                    style={{ width: `${Math.min(100, progress.percentComplete)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600">
                  منفّذ {progress.completedTotal.toLocaleString('ar-EG')} · قيد التنفيذ{' '}
                  {progress.inProgressTotal.toLocaleString('ar-EG')} · متبقي{' '}
                  {progress.remainingTotal.toLocaleString('ar-EG')} · مطلوب{' '}
                  {progress.requiredTotal.toLocaleString('ar-EG')}
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CompactFormField label="رقم أمر الشغل">
                <input className={compactControlClass} value={workOrder.orderNumber} readOnly />
              </CompactFormField>
              <CompactFormField label="تاريخ الأمر">
                <input
                  className={compactControlClass}
                  value={String(workOrder.workDate).slice(0, 10)}
                  readOnly
                />
              </CompactFormField>
              <CompactFormField label="أمر البيع">
                {salesOrderId ? (
                  <Link
                    href={`/manufacturing/operations/sales-order?orderId=${encodeURIComponent(salesOrderId)}`}
                    className="flex h-9 items-center text-sm font-semibold text-[#0E78AA] underline-offset-2 hover:underline"
                  >
                    {planningMeta.salesOrderNumber ||
                      workOrder.salesOrder?.invoiceNumber ||
                      'فتح أمر البيع'}
                  </Link>
                ) : (
                  <span className="text-sm text-slate-500">—</span>
                )}
              </CompactFormField>
            </div>
            {workOrder.description ? (
              <p className="mt-2 text-xs text-slate-600">{workOrder.description}</p>
            ) : null}
          </FormSectionCard>

          <MfgTableCard
            title="التخطيط الإنتاجي"
            scrollViewport
            toolbar={
              <Link
                href="/manufacturing/creations/manufacturing-model"
                target="_blank"
                className="text-xs font-semibold text-[#0E78AA] underline-offset-2 hover:underline"
              >
                تعريف نموذج تصنيع لصنف تام
              </Link>
            }
          >
            <div className={mfgTableScrollViewportClass}>
              <table className={mfgTableClass}>
                <thead className={mfgTheadClass}>
                  <tr>
                    <th className={mfgThClass}>الصنف</th>
                    <th className={mfgThClass}>المواصفات</th>
                    <th className={mfgThClass}>نموذج التصنيع</th>
                    <th className={cn(mfgThClass, 'w-28')}>الكمية المطلوبة</th>
                    <th className={mfgThClass}>منفّذ</th>
                    <th className={mfgThClass}>متبقي</th>
                    <th className={mfgThClass}>%</th>
                    <th className={cn(mfgThClass, 'w-52')}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.length === 0 ? (
                    <MfgEmptyRow colSpan={8}>لا توجد أصناف في أمر الشغل</MfgEmptyRow>
                  ) : (
                    planRows.map((row, rowIndex) => {
                      const bomProgress = row.bomId ? progressByBomId.get(row.bomId) : undefined;
                      return (
                      <tr key={row.id} className={mfgTrClass}>
                        <td className={mfgTdClass}>
                          {canEditLineItems ? (
                            <ItemSelect
                              value={row.itemId}
                              disabled={planningLocked}
                              onChange={(id) => {
                                const b = resolveRowBom(id);
                                patchPlanRow(rowIndex, {
                                  itemId: id,
                                  bomId: b.bomId,
                                  bomName: b.bomName,
                                });
                              }}
                              onItemResolved={(item) => {
                                if (!item) return;
                                const b = resolveRowBom(item.id);
                                patchPlanRow(rowIndex, {
                                  itemId: item.id,
                                  itemName: item.arabicName,
                                  bomId: b.bomId,
                                  bomName: b.bomName,
                                });
                              }}
                            />
                          ) : (
                            <span className="text-sm text-[#0A3D5E]">{row.itemName}</span>
                          )}
                        </td>
                        <td className={mfgTdClass}>
                          {canEditLineItems ? (
                            <input
                              className={compactControlClass}
                              value={row.lineDescription}
                              disabled={planningLocked}
                              onChange={(e) =>
                                patchPlanRow(rowIndex, { lineDescription: e.target.value })
                              }
                            />
                          ) : (
                            <span className="text-sm">{row.lineDescription || '—'}</span>
                          )}
                        </td>
                        <td className={mfgTdClass}>
                          <span
                            className={`text-sm ${row.bomId ? 'text-[#0A3D5E]' : 'text-rose-600'}`}
                          >
                            {row.bomName || '—'}
                          </span>
                        </td>
                        <td className={mfgTdClass}>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className={compactControlClass}
                            value={row.modelCount}
                            disabled={planningLocked}
                            onChange={(e) =>
                              patchPlanRow(rowIndex, { modelCount: e.target.value })
                            }
                          />
                        </td>
                        <td className={mfgTdClass}>
                          {(bomProgress?.completedQuantity ?? 0).toLocaleString('ar-EG')}
                        </td>
                        <td className={mfgTdClass}>
                          {bomProgress
                            ? bomProgress.remainingQuantity.toLocaleString('ar-EG')
                            : '—'}
                        </td>
                        <td className={mfgTdClass}>
                          {bomProgress
                            ? `${bomProgress.percentComplete.toLocaleString('ar-EG')}%`
                            : '—'}
                        </td>
                        <td className={mfgTdClass}>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy || planningLocked}
                              onClick={() => void handleCheckRow(row)}
                            >
                              فحص الكميات
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="bg-[#0E78AA] hover:bg-[#0B6188]"
                              disabled={busy || planningLocked}
                              onClick={() => void handleManufacture(row)}
                            >
                              تصنيع
                            </Button>
                            {canEditLineItems ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={planRows.length <= 1 || planningLocked}
                                onClick={() =>
                                  setPlanRows((prev) => prev.filter((r) => r.id !== row.id))
                                }
                                aria-label="حذف السطر"
                              >
                                <Trash2 className="h-4 w-4 text-rose-600" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {canEditLineItems ? (
              <div className="border-t border-[#E6F0F7] px-4 py-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setPlanRows((prev) => [...prev, emptyProductionRow()])}
                >
                  <Plus className="ms-1 h-4 w-4" />
                  إضافة صنف
                </Button>
              </div>
            ) : null}
          </MfgTableCard>
        </>
      )}

      <ManufacturingQuantityCheckDialog
        open={showQtyCheck}
        onClose={() => setShowQtyCheck(false)}
        rows={checkProcess?.raws ?? []}
        defaultWarehouseId={checkProcess?.fromWarehouseId ?? ''}
      />

      <DocumentBrowseDrawer
        open={showBrowse}
        onClose={() => setShowBrowse(false)}
        title="أوامر الشغل"
      >
        <div className="space-y-2">
          {workOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">لا توجد أوامر شغل</p>
          ) : (
            workOrders.map((wo) => (
              <button
                key={wo.id}
                type="button"
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D6EAF3] bg-white px-3 py-2 text-right hover:bg-[#F8FBFD]"
                onClick={() => openWorkOrder(wo.id)}
              >
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-[#0A3D5E]">{wo.orderNumber}</p>
                  <p className="text-xs text-slate-500">{wo.description || '—'}</p>
                </div>
                <span className="text-xs text-slate-400">
                  {wo.bom?.name ? `نموذج: ${wo.bom.name}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      </DocumentBrowseDrawer>
    </ManufacturingPageChrome>
  );
}
