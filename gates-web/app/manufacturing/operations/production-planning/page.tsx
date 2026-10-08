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
  buildProductionPlanRowsFromBomPlans,
  mergePlanningMeta,
  parseWorkOrderPlanningMeta,
  resolveBomForFinishedItem,
  type ProductionPlanRow,
} from '@/lib/manufacturing/work-order-planning';
import { workOrderWarehousesFromMetadata } from '@/lib/manufacturing/hydrate-from-work-order';
import {
  hasMfgRawStockShortage,
  mfgQuantityCheckButtonClass,
  MFG_QUANTITY_SHORTAGE_HINT_AR,
} from '@/lib/manufacturing/mfg-quantity-check-ui';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui';
import {
  manufacturingWorkOrderStatusLabel,
  workOrderStatusTone,
} from '@/lib/manufacturing/work-order-status';
import {
  DocumentModeProvider,
  useDocumentMode,
} from '@/components/common/document-shell';
import { confirmAction } from '@/lib/feedback/confirm';

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

type SalesLineRow = {
  id: string;
  itemId: string;
  itemName: string;
  lineDescription: string;
  plannedQuantity: string;
};

function emptySalesLineRow(): SalesLineRow {
  return {
    id: newRowId(),
    itemId: '',
    itemName: '',
    lineDescription: '',
    plannedQuantity: '1',
  };
}

function salesLinesFromWorkOrder(wo: WorkOrderDetail): SalesLineRow[] {
  return (wo.lines ?? []).map((line, index) => ({
    id: `sl-${index}-${line.itemId}`,
    itemId: line.itemId,
    itemName: line.item?.arabicName ?? line.itemId,
    lineDescription: line.lineDescription?.trim() ?? '',
    plannedQuantity: String(line.plannedQuantity ?? ''),
  }));
}

function num(v: string | number | null | undefined): number {
  return Number(v ?? 0);
}

export default function ProductionPlanningPage() {
  return (
    <DocumentModeProvider initialMode="create">
      <Suspense fallback={<p className="p-6 text-sm text-slate-500">جاري التحميل…</p>}>
        <ProductionPlanningInner />
      </Suspense>
    </DocumentModeProvider>
  );
}

function ProductionPlanningInner() {
  useBackendReachability();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateQuery = useInvalidateQuery();
  const { unlockForEdit, lockToView, isReadOnly } = useDocumentMode();

  const [workOrderId, setWorkOrderId] = useState<string | null>(null);
  const [draftNew, setDraftNew] = useState(false);
  const [lineRows, setLineRows] = useState<SalesLineRow[]>([]);
  const [planRows, setPlanRows] = useState<ProductionPlanRow[]>([]);
  const [draftDescription, setDraftDescription] = useState('');
  const [draftWorkDate, setDraftWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [draftOrderNumber, setDraftOrderNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const [checkProcess, setCheckProcess] = useState<LoadedManufacturingProcess | null>(null);
  const [showQtyCheck, setShowQtyCheck] = useState(false);
  const [qtyShortageByRowId, setQtyShortageByRowId] = useState<Record<string, boolean>>({});
  const [qtyCheckEmphasizeShortages, setQtyCheckEmphasizeShortages] = useState(false);
  const loadedIdRef = useRef<string | null>(null);

  const { data: bomsRes } = useApiQuery<BomListItem[]>(
    ['manufacturing-boms'],
    '/manufacturing/boms'
  );
  const boms = bomsRes?.data ?? [];
  const bomById = useMemo(() => new Map(boms.map((b) => [b.id, b])), [boms]);

  useManufacturingWorkOrderSerial({
    enabled: draftNew && !workOrderId,
    setSerial: setDraftOrderNumber,
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
  const fieldsLocked = planningLocked || (isReadOnly && Boolean(workOrderId) && !draftNew);

  const { data: progressRes, refetch: refetchProgress } = useApiQuery<WorkOrderProgress>(
    ['manufacturing-work-order-progress', workOrderId],
    `/manufacturing/work-orders/${workOrderId}/progress`,
    undefined,
    {
      enabled: Boolean(workOrderId),
      refetchOnWindowFocus: true,
    }
  );

  useEffect(() => {
    if (!workOrderId) return;
    const refresh = () => void refetchProgress();
    window.addEventListener('focus', refresh);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [workOrderId, refetchProgress]);
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

  function applyWorkOrderToForm(wo: WorkOrderDetail) {
    setLineRows(salesLinesFromWorkOrder(wo));
    const meta = parseWorkOrderPlanningMeta(wo.processMetadata ?? null);
    setPlanRows(buildProductionPlanRowsFromBomPlans(boms, meta));
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
    setDraftNew(false);
    applyWorkOrderToForm(workOrder);
    lockToView();
  }, [workOrder, lockToView]);

  useEffect(() => {
    if (!workOrder?.id || !boms.length) return;
    const key = `${workOrder.id}:${boms.length}`;
    if (planSyncKeyRef.current === key) return;
    planSyncKeyRef.current = key;
    if (loadedIdRef.current === workOrder.id) {
      const meta = parseWorkOrderPlanningMeta(workOrder.processMetadata ?? null);
      setPlanRows(buildProductionPlanRowsFromBomPlans(boms, meta));
    }
  }, [workOrder, boms]);

  const canEditLineItems = Boolean(
    (draftNew || (workOrder && !workOrder.salesOrderInvoiceId)) && !fieldsLocked
  );
  const showWorkOrderForm = draftNew || Boolean(workOrderId);

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
      lines: lineRows
        .filter((r) => r.itemId)
        .map((row, index) => ({
          itemId: row.itemId,
          plannedQuantity: Math.max(0, Number(row.plannedQuantity) || 0),
          completedQuantity: 0,
          lineDescription: row.lineDescription?.trim() || null,
          lineOrder: index + 1,
        })),
    };
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    if (draftNew) {
      await handleCreateFromDraft();
      return;
    }
    if (!workOrderId || !workOrder) {
      setError('افتح أمر شغل من القائمة أو من أمر البيع');
      return;
    }
    const activePlans = planRows.filter((r) => r.bomId);
    if (!activePlans.length) {
      setError('أضف نموذج تصنيع واحداً على الأقل في التخطيط الإنتاجي');
      return;
    }
    if (activePlans.some((r) => !Number.isFinite(Number(r.modelCount)) || Number(r.modelCount) <= 0)) {
      setError('أدخل كمية صحيحة لكل نموذج في التخطيط');
      return;
    }
    await saveMutation.mutateAsync(buildSavePayload());
  }

  function patchPlanRow(index: number, patch: Partial<ProductionPlanRow>) {
    setPlanRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function patchSalesLineRow(index: number, patch: Partial<SalesLineRow>) {
    setLineRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  const canEditPlanning = !planningLocked && !fieldsLocked;

  function patchPlanRowBom(index: number, bomId: string) {
    const bom = bomById.get(bomId);
    if (!bom) {
      patchPlanRow(index, {
        bomId: '',
        bomName: '',
        itemId: '',
        itemName: '',
        lineDescription: '',
      });
      return;
    }
    patchPlanRow(index, {
      bomId: bom.id,
      bomName: bom.name,
      itemId: bom.finishedItemId ?? bom.finishedItem?.id ?? '',
      itemName: bom.finishedItem?.arabicName ?? '',
      lineDescription: bom.formMetadata?.description?.trim() ?? '',
    });
  }

  function addPlanRow() {
    setPlanRows((prev) => [...prev, emptyProductionRow()]);
  }

  function removePlanRow(index: number) {
    setPlanRows((prev) => prev.filter((_, i) => i !== index));
  }

  function resolveRowBom(itemId: string) {
    const bom = resolveBomForFinishedItem(boms, itemId);
    return {
      bomId: bom?.id ?? '',
      bomName: bom?.name ?? 'لا يوجد نموذج لهذا الصنف',
    };
  }

  async function handleCreateFromDraft() {
    setError(null);
    const lines = lineRows.filter((l) => l.itemId && Number(l.plannedQuantity) > 0);
    if (!lines.length) {
      setError('أضف صنفاً واحداً على الأقل');
      return;
    }
    if (lines.some((l) => !resolveBomForFinishedItem(boms, l.itemId))) {
      setError('بعض الأصناف بلا نموذج تصنيع مرتبط');
      return;
    }
    if (planRows.some((r) => r.itemId && !r.bomId)) {
      setError('بعض الأصناف بلا نموذج تصنيع — عرّف نموذجاً للصنف التام أولاً');
      return;
    }
    let plans = planRows.filter((r) => r.itemId);
    if (!plans.length) {
      plans = lines.map((l) => ({
        ...emptyProductionRow(),
        itemId: l.itemId,
        itemName: l.itemName,
        lineDescription: l.lineDescription,
        modelCount: l.plannedQuantity,
        ...resolveRowBom(l.itemId),
      }));
    }
    const bomPlans = bomPlansFromProductionRows(plans);
    const res = await createWorkOrderMutation.mutateAsync({
      orderNumber: draftOrderNumber || undefined,
      description: draftDescription.trim() || 'أمر شغل يدوي',
      workDate: draftWorkDate,
      modelQuantity: bomPlans[0]?.modelCount ?? 1,
      status: 'CONFIRMED',
      processMetadata: { bomPlans },
      lines: lines.map((l, i) => ({
        itemId: l.itemId,
        plannedQuantity: Number(l.plannedQuantity),
        lineDescription: l.lineDescription?.trim() || null,
        lineOrder: i + 1,
      })),
    });
    if (res.data?.id) {
      setDraftNew(false);
      openWorkOrder(res.data.id);
      setSuccess('تم إنشاء أمر الشغل');
    }
  }

  function handleStartNewDraft() {
    setWorkOrderId(null);
    loadedIdRef.current = null;
    planSyncKeyRef.current = null;
    setDraftNew(true);
    setLineRows([emptySalesLineRow()]);
    setPlanRows([]);
    setDraftDescription('');
    setDraftWorkDate(new Date().toISOString().slice(0, 10));
    setDraftOrderNumber('');
    setError(null);
    setSuccess(null);
    unlockForEdit();
    router.replace('/manufacturing/operations/production-planning');
  }

  async function handleCancelWorkOrder() {
    if (!workOrderId || !workOrder) return;
    const ok = await confirmAction({
      message: 'إلغاء أمر الشغل ووسمه «ملغي»؟',
      confirmLabel: 'إلغاء أمر الشغل',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await apiClient.post<WorkOrderDetail>(
        `/manufacturing/work-orders/${workOrderId}/cancel`
      );
      invalidateQuery(['manufacturing-work-order', workOrderId]);
      invalidateQuery(['manufacturing-work-orders-list']);
      if (res.data) applyWorkOrderToForm(res.data);
      setSuccess('تم إلغاء أمر الشغل');
      lockToView();
    } catch (err) {
      setError((err as ApiError).message || 'تعذر إلغاء أمر الشغل');
    } finally {
      setBusy(false);
    }
  }

  async function loadBomProcess(row: ProductionPlanRow): Promise<LoadedManufacturingProcess | null> {
    if (!row.bomId) return null;
    const qty = Number(row.modelCount);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    const res = await apiClient.get<BomForProcess>(`/manufacturing/boms/${row.bomId}`);
    return buildLoadedProcessFromBom(res.data, qty);
  }

  const planRowsShortageKey = useMemo(
    () =>
      planRows
        .map((r) => `${r.id}:${r.bomId}:${r.modelCount}`)
        .join('|'),
    [planRows]
  );

  useEffect(() => {
    if (!workOrder || planRows.length === 0) {
      setQtyShortageByRowId({});
      return;
    }
    const whMeta = workOrderWarehousesFromMetadata({
      processMetadata: workOrder.processMetadata,
      id: workOrder.id,
      orderNumber: workOrder.orderNumber,
      bomId: workOrder.bomId,
      modelQuantity: workOrder.modelQuantity,
    });
    let cancelled = false;
    void (async () => {
      const next: Record<string, boolean> = {};
      for (const row of planRows) {
        if (!row.bomId) {
          next[row.id] = false;
          continue;
        }
        try {
          const loaded = await loadBomProcess(row);
          const wh = loaded?.fromWarehouseId || whMeta.fromWarehouseId;
          next[row.id] = await hasMfgRawStockShortage(loaded, wh);
        } catch {
          next[row.id] = false;
        }
      }
      if (!cancelled) setQtyShortageByRowId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [workOrder, planRowsShortageKey]);

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
      setQtyCheckEmphasizeShortages(Boolean(qtyShortageByRowId[row.id]));
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
    setDraftNew(false);
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
      docNumber={draftNew ? draftOrderNumber || undefined : workOrder?.orderNumber}
      currentId={draftNew ? null : workOrderId}
      favoriteHref="/manufacturing/operations/production-planning"
      onSave={() => void handleSave()}
      savePending={saveMutation.isPending || createWorkOrderMutation.isPending || busy}
      canSave={Boolean(draftNew || workOrder) && !fieldsLocked}
      saveLabel={draftNew ? 'حفظ أمر الشغل' : 'حفظ أمر الشغل'}
      onBrowseList={() => setShowBrowse(true)}
      browseListLabel="أوامر الشغل"
      statusLabel={
        draftNew ? 'جديد' : workOrder ? manufacturingWorkOrderStatusLabel(workOrder.status) : 'جديد'
      }
      statusTone={workOrder ? workOrderStatusTone(workOrder.status) : 'info'}
      standardActions={{
        hasDocument: Boolean(workOrderId),
        isCancelled: workOrder?.status === 'CANCELLED',
        hidePostActions: true,
        allowEditWhenPosted: true,
        onNew: handleStartNewDraft,
        newLabel: 'أمر شغل جديد',
        onEdit: () => unlockForEdit(),
        onVoid:
          workOrderId &&
          workOrder &&
          workOrder.status !== 'CANCELLED' &&
          workOrder.status !== 'COMPLETED' &&
          workOrder.status !== 'CLOSED'
            ? () => void handleCancelWorkOrder()
            : undefined,
        voidLabel: 'إلغاء أمر الشغل',
        editLockedHint: fieldsLocked ? 'اضغط «تعديل» من القائمة أو الأمر مغلق/ملغي' : undefined,
      }}
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
      {!showWorkOrderForm ? (
        <FormSectionCard title="أمر الشغل">
          <p className="text-sm text-slate-600">
            من أمر البيع: «إنشاء أمر شغل» ثم افتحه هنا، أو اختر أمراً سابقاً، أو أنشئ أمر شغل جديد بنفس
            شاشة التحميل.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setShowBrowse(true)}>
              اختيار أمر شغل
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => handleStartNewDraft()}>
              أمر شغل جديد
            </Button>
          </div>
        </FormSectionCard>
      ) : workOrderId && woLoading && !workOrder ? (
        <p className="text-sm text-slate-500">جاري تحميل أمر الشغل…</p>
      ) : workOrderId && !workOrder ? (
        <p className="text-sm text-rose-600">تعذر تحميل أمر الشغل</p>
      ) : (
        <>
          <FormSectionCard title="بيانات أمر الشغل">
            {progress && !draftNew ? (
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
                <p className="text-xs text-slate-500">
                  «منفّذ» يزيد بعد «إنهاء» أمر التصنيع. أمر محفوظ أو قيد التنفيذ (صرف خامات) يظهر في «قيد
                  التنفيذ».
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CompactFormField label="رقم أمر الشغل">
                <input
                  className={compactControlClass}
                  value={draftNew ? draftOrderNumber : workOrder?.orderNumber ?? ''}
                  readOnly
                />
              </CompactFormField>
              <CompactFormField label="تاريخ الأمر">
                <input
                  type={draftNew ? 'date' : undefined}
                  className={compactControlClass}
                  value={
                    draftNew
                      ? draftWorkDate
                      : String(workOrder?.workDate ?? '').slice(0, 10)
                  }
                  readOnly={!draftNew}
                  onChange={
                    draftNew
                      ? (e) => setDraftWorkDate(e.target.value)
                      : undefined
                  }
                />
              </CompactFormField>
              <CompactFormField label="أمر البيع">
                {!draftNew && salesOrderId ? (
                  <Link
                    href={`/manufacturing/operations/sales-order?orderId=${encodeURIComponent(salesOrderId)}`}
                    className="flex h-9 items-center text-sm font-semibold text-[#0E78AA] underline-offset-2 hover:underline"
                  >
                    {planningMeta.salesOrderNumber ||
                      workOrder?.salesOrder?.invoiceNumber ||
                      'فتح أمر البيع'}
                  </Link>
                ) : (
                  <span className="text-sm text-slate-500">—</span>
                )}
              </CompactFormField>
              {draftNew ? (
                <CompactFormField label="الشرح" className="sm:col-span-2 lg:col-span-4">
                  <input
                    className={compactControlClass}
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    placeholder="وصف أمر الشغل"
                    disabled={fieldsLocked}
                  />
                </CompactFormField>
              ) : null}
            </div>
            {!draftNew && workOrder?.description ? (
              <p className="mt-2 text-xs text-slate-600">{workOrder.description}</p>
            ) : null}
          </FormSectionCard>

          <MfgTableCard title="أصناف أمر البيع" scrollViewport>
            <div className={mfgTableScrollViewportClass}>
              <table className={mfgTableClass}>
                <thead className={mfgTheadClass}>
                  <tr>
                    <th className={mfgThClass}>الصنف</th>
                    <th className={mfgThClass}>المواصفات</th>
                    <th className={cn(mfgThClass, 'w-32')}>الكمية المطلوبة</th>
                    {canEditLineItems ? <th className={cn(mfgThClass, 'w-12')} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {lineRows.length === 0 ? (
                    <MfgEmptyRow colSpan={canEditLineItems ? 4 : 3}>
                      لا توجد أصناف في أمر الشغل
                    </MfgEmptyRow>
                  ) : (
                    lineRows.map((row, rowIndex) => (
                      <tr key={row.id} className={mfgTrClass}>
                        <td className={mfgTdClass}>
                          {canEditLineItems ? (
                            <ItemSelect
                              value={row.itemId}
                              disabled={fieldsLocked}
                              onChange={(id) => patchSalesLineRow(rowIndex, { itemId: id })}
                              onItemResolved={(item) => {
                                if (!item) return;
                                patchSalesLineRow(rowIndex, {
                                  itemId: item.id,
                                  itemName: item.arabicName,
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
                              disabled={fieldsLocked}
                              onChange={(e) =>
                                patchSalesLineRow(rowIndex, { lineDescription: e.target.value })
                              }
                            />
                          ) : (
                            <span className="text-sm">{row.lineDescription || '—'}</span>
                          )}
                        </td>
                        <td className={mfgTdClass}>
                          {canEditLineItems ? (
                            <input
                              type="number"
                              min={0}
                              step="any"
                              className={compactControlClass}
                              value={row.plannedQuantity}
                              disabled={fieldsLocked}
                              onChange={(e) =>
                                patchSalesLineRow(rowIndex, { plannedQuantity: e.target.value })
                              }
                            />
                          ) : (
                            <span className="text-sm font-medium">
                              {num(row.plannedQuantity).toLocaleString('ar-EG')}
                            </span>
                          )}
                        </td>
                        {canEditLineItems ? (
                          <td className={mfgTdClass}>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={lineRows.length <= 1 || fieldsLocked}
                              onClick={() =>
                                setLineRows((prev) => prev.filter((_, i) => i !== rowIndex))
                              }
                              aria-label="حذف السطر"
                            >
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))
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
                  onClick={() => setLineRows((prev) => [...prev, emptySalesLineRow()])}
                >
                  <Plus className="ms-1 h-4 w-4" />
                  إضافة صنف
                </Button>
              </div>
            ) : null}
          </MfgTableCard>

          <div className="mt-4">
            <MfgTableCard
              title="التخطيط الإنتاجي"
              scrollViewport
              toolbar={
                <Link
                  href="/manufacturing/creations/manufacturing-model"
                  target="_blank"
                  className="text-xs font-semibold text-[#0E78AA] underline-offset-2 hover:underline"
                >
                  تعريف نموذج تصنيع/قائمة مواد
                </Link>
              }
            >
              <div className={mfgTableScrollViewportClass}>
                <table className={mfgTableClass}>
                  <thead className={mfgTheadClass}>
                    <tr>
                      <th className={mfgThClass}>نموذج التصنيع</th>
                      <th className={mfgThClass}>الصنف التام</th>
                      <th className={cn(mfgThClass, 'w-28')}>الكمية</th>
                      <th className={mfgThClass}>قيد التنفيذ</th>
                      <th className={mfgThClass}>منفّذ</th>
                      <th className={mfgThClass}>متبقي</th>
                      <th className={mfgThClass}>%</th>
                      <th className={cn(mfgThClass, 'w-52')}>إجراءات</th>
                      {canEditPlanning ? <th className={cn(mfgThClass, 'w-12')} /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {planRows.length === 0 ? (
                      <MfgEmptyRow colSpan={canEditPlanning ? 9 : 8}>
                        لا توجد نماذج في الخطة — اضغط «إضافة نموذج» واختر نموذج التصنيع والكمية
                      </MfgEmptyRow>
                    ) : (
                      planRows.map((row, rowIndex) => {
                        const bomProgress = row.bomId ? progressByBomId.get(row.bomId) : undefined;
                        const bomMeta = row.bomId ? bomById.get(row.bomId) : undefined;
                        const specs =
                          row.lineDescription?.trim() ||
                          bomMeta?.formMetadata?.description?.trim() ||
                          '—';
                        return (
                          <tr key={row.id} className={mfgTrClass}>
                            <td className={mfgTdClass}>
                              {canEditPlanning ? (
                                <select
                                  className={compactControlClass}
                                  value={row.bomId}
                                  onChange={(e) => patchPlanRowBom(rowIndex, e.target.value)}
                                >
                                  <option value="">— اختر نموذج التصنيع —</option>
                                  {boms.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  className={`text-sm ${row.bomId ? 'text-[#0A3D5E]' : 'text-rose-600'}`}
                                >
                                  {row.bomName || '—'}
                                </span>
                              )}
                            </td>
                            <td className={mfgTdClass}>
                              <span className="text-sm text-[#0A3D5E]">
                                {row.itemName || (row.bomId ? '—' : '')}
                              </span>
                              {canEditPlanning ? (
                                <input
                                  className={cn(compactControlClass, 'mt-1 text-xs')}
                                  placeholder="ملاحظات / مواصفات"
                                  value={row.lineDescription}
                                  onChange={(e) =>
                                    patchPlanRow(rowIndex, { lineDescription: e.target.value })
                                  }
                                />
                              ) : specs !== '—' ? (
                                <p className="mt-0.5 text-xs text-slate-500">{specs}</p>
                              ) : null}
                            </td>
                            <td className={mfgTdClass}>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                className={compactControlClass}
                                value={row.modelCount}
                                disabled={!canEditPlanning}
                                onChange={(e) =>
                                  patchPlanRow(rowIndex, { modelCount: e.target.value })
                                }
                              />
                            </td>
                            <td className={mfgTdClass}>
                              <span
                                className={
                                  (bomProgress?.inProgressQuantity ?? 0) > 0
                                    ? 'font-semibold text-amber-800'
                                    : 'text-slate-600'
                                }
                              >
                                {(bomProgress?.inProgressQuantity ?? 0).toLocaleString('ar-EG')}
                              </span>
                            </td>
                            <td className={mfgTdClass}>
                              <span
                                className={
                                  (bomProgress?.completedQuantity ?? 0) > 0
                                    ? 'font-semibold text-emerald-800'
                                    : ''
                                }
                              >
                                {(bomProgress?.completedQuantity ?? 0).toLocaleString('ar-EG')}
                              </span>
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
                              <div className="flex min-w-[11rem] flex-col items-stretch gap-1">
                                {qtyShortageByRowId[row.id] ? (
                                  <p className="text-xs font-semibold leading-snug text-rose-600">
                                    {MFG_QUANTITY_SHORTAGE_HINT_AR}
                                  </p>
                                ) : null}
                                <div className="flex flex-wrap gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={busy || planningLocked || !row.bomId}
                                  className={mfgQuantityCheckButtonClass(
                                    Boolean(qtyShortageByRowId[row.id])
                                  )}
                                  onClick={() => void handleCheckRow(row)}
                                >
                                  فحص الكميات
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-[#0E78AA] hover:bg-[#0B6188]"
                                  disabled={busy || planningLocked || !row.bomId}
                                  onClick={() => void handleManufacture(row)}
                                >
                                  تصنيع
                                </Button>
                                </div>
                              </div>
                            </td>
                            {canEditPlanning ? (
                              <td className={mfgTdClass}>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removePlanRow(rowIndex)}
                                  aria-label="حذف السطر"
                                >
                                  <Trash2 className="h-4 w-4 text-rose-600" />
                                </Button>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {canEditPlanning ? (
                <div className="border-t border-[#E6F0F7] px-4 py-2">
                  <Button type="button" size="sm" variant="secondary" onClick={addPlanRow}>
                    <Plus className="ms-1 h-4 w-4" />
                    إضافة نموذج
                  </Button>
                </div>
              ) : null}
            </MfgTableCard>
          </div>
        </>
      )}

      <ManufacturingQuantityCheckDialog
        open={showQtyCheck}
        onClose={() => {
          setShowQtyCheck(false);
          setQtyCheckEmphasizeShortages(false);
        }}
        rows={checkProcess?.raws ?? []}
        defaultWarehouseId={checkProcess?.fromWarehouseId ?? ''}
        emphasizeShortages={qtyCheckEmphasizeShortages}
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
