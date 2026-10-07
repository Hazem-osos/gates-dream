'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import {
  CompactFormField,
  FormSectionCard,
  compactControlClass,
  WorkflowStepper,
  CostRollupCard,
  Button,
} from '@/components/ui';
import { ManufacturingPageChrome } from '@/components/manufacturing/ManufacturingPageChrome';
import { ManufacturingProcessLinesEditor } from '@/components/manufacturing/ManufacturingProcessLinesEditor';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { useAccountingSettings } from '@/lib/hooks/useAccountingSettings';
import { useManufacturingOrderSerial } from '@/lib/manufacturing/use-manufacturing-order-serial';
import {
  COMPANY_NEGATIVE_STOCK_SETTINGS_HREF,
  findMfgRawStockShortages,
  formatMfgShortageBlock,
} from '@/lib/manufacturing/mfg-raw-stock-shortages';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ManufacturingQuantityCheckDialog } from '@/components/manufacturing/ManufacturingQuantityCheckDialog';
import {
  buildLoadedProcessFromBom,
  buildLoadedProcessFromOrderMetadata,
  createEmptyLoadedProcess,
  enrichLoadedProcessWithItemCosts,
  processHasLineContent,
  type LoadedManufacturingProcess,
  type BomForProcess,
} from '@/lib/manufacturing/process-from-bom';
import {
  describeWorkOrderFinishedProducts,
  fetchWorkOrderAndBom,
  hydrateLoadedProcessFromWorkOrder,
  type WorkOrderFinishedProductSource,
  type WorkOrderForHydrate,
} from '@/lib/manufacturing/hydrate-from-work-order';
import { getAllowedBomIds, getBomPlan } from '@/lib/manufacturing/work-order-planning';
import {
  computeMaxManufacturingQuantity,
  formatWorkOrderQuantityCapMessage,
  sumDraftPlannedForBom,
  type WorkOrderBomProgressRow,
} from '@/lib/manufacturing/work-order-bom-quantity-cap';
import {
  computeAdditionalCostsTotal,
  computeRawMaterialsTotal,
} from '@/lib/manufacturing/bom-cost-distribution';
import { stashMfgTransferPrefill } from '@/lib/manufacturing/mfg-transfer-prefill';
import { buildShortageTransferLines, shortageTransferError } from '@/lib/manufacturing/mfg-transfer-shortage';
import { consumeMfgOperationPrefill } from '@/lib/manufacturing/mfg-operation-prefill';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import {
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';
import {
  PRODUCTION_ORDER_WORKFLOW_STEPS,
  productionOrderStatusLabel,
  productionOrderWorkflowStepIndex,
  type ProductionOrderStatus,
} from '@/lib/manufacturing/production-order-status';
import {
  isWorkOrderSelectableForProductionOrder,
  manufacturingWorkOrderStatusLabel,
} from '@/lib/manufacturing/work-order-status';

interface BomLine {
  id?: string;
  rawItemId: string;
  quantity: string | number;
  scrapPercentage: string | number;
  lineOrder: number;
  rawItem?: { id: string; arabicName: string; serial: string | null };
}

interface Bom extends BomForProcess {
  lines?: BomLine[];
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  bomId: string;
  manufacturingWorkOrderId?: string | null;
  manufacturingWorkOrder?: { id: string; orderNumber: string; status: string } | null;
  status: 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  plannedQuantity: string | number;
  actualQuantity: string | number | null;
  warehouseIdRaw: string;
  warehouseIdFinished: string;
  totalMaterialCost: string | number;
  totalLaborCost: string | number;
  totalOverheadCost: string | number;
  unitCost: string | number;
  materialsIssueJournalEntryId: string | null;
  completionJournalEntryId: string | null;
  processMetadata?: Record<string, unknown> | null;
  bom?: { id: string; name: string };
  finishedItem?: { id: string; arabicName: string; serial?: string | null };
}

interface ProductionOrderListRow {
  id: string;
  orderNumber: string;
  status: ProductionOrder['status'];
  bomId?: string;
  manufacturingWorkOrderId?: string | null;
  plannedQuantity: string | number;
  processMetadata?: Record<string, unknown> | null;
  bom?: { id: string; name: string };
  finishedItem?: { id: string; arabicName: string; serial?: string | null };
}

type WorkOrderProgressSnapshot = {
  bomRows: WorkOrderBomProgressRow[];
};

function processMetaDescription(meta: Record<string, unknown> | null | undefined): string {
  const d = meta?.description;
  return typeof d === 'string' ? d.trim() : '';
}

const POSTED_STATUSES = ['IN_PROGRESS', 'COMPLETED'];

function num(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

type MfgOperationDraft = {
  order: ProductionOrder | null;
  serial: string;
  description: string;
  date: string;
  model: string;
  stage: string;
  fromWarehouse: string;
  toWarehouse: string;
  costCenter: string;
  operationShiftNumber: string;
  standardExecutionTime: string;
  numberOfModels: string;
  loadedProcess: LoadedManufacturingProcess | null;
};

function isMfgOperationDraftEmpty(draft: MfgOperationDraft): boolean {
  return (
    !draft.order &&
    !draft.serial.trim() &&
    !draft.description.trim() &&
    !draft.model &&
    !draft.fromWarehouse &&
    !draft.toWarehouse &&
    !draft.loadedProcess &&
    draft.numberOfModels === '1'
  );
}

function statusLabel(status: ProductionOrderStatus | undefined): string {
  if (!status) return 'جديد';
  return productionOrderStatusLabel(status);
}

export default function ManufacturingOperationPage() {
  return (
    <DocumentModeProvider>
      <ManufacturingOperationPageInner />
    </DocumentModeProvider>
  );
}

function ManufacturingOperationPageInner() {
  useBackendReachability();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateQuery = useInvalidateQuery();
  const { unlockForEdit, lockToView } = useDocumentMode();

  const [serial, setSerial] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [model, setModel] = useState('');
  const [stage, setStage] = useState('');
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [operationShiftNumber, setOperationShiftNumber] = useState('');
  const [standardExecutionTime, setStandardExecutionTime] = useState('');
  const [numberOfModels, setNumberOfModels] = useState('1');
  const [loadedProcess, setLoadedProcess] = useState<LoadedManufacturingProcess | null>(null);
  const [showQtyCheck, setShowQtyCheck] = useState(false);
  const [showTransferPick, setShowTransferPick] = useState(false);
  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPreviousDrawer, setShowPreviousDrawer] = useState(false);
  const [showWorkOrderPicker, setShowWorkOrderPicker] = useState(false);
  const [manufacturingWorkOrderId, setManufacturingWorkOrderId] = useState('');
  const [linkedWorkOrderNumber, setLinkedWorkOrderNumber] = useState('');
  const skipDraftApplyRef = useRef(false);
  const processReloadPendingRef = useRef(false);
  const workOrderDeepLinkRef = useRef<string | null>(null);
  const workOrderAutoDescriptionRef = useRef('');

  const { data: accountingSettingsRes } = useAccountingSettings();
  const preventNegativeStock =
    accountingSettingsRes?.data?.controls?.preventNegativeStock !== false &&
    accountingSettingsRes?.data?.controls?.allowNegativeBalance !== true;

  const { serialAutomatic, invalidateNextSerial } = useManufacturingOrderSerial({
    enabled: !order,
    setSerial,
  });

  const bomEditHref = model
    ? `/manufacturing/creations/manufacturing-model?id=${encodeURIComponent(model)}`
    : undefined;
  const finishedWarehouseId = toWarehouse || loadedProcess?.toWarehouseId || fromWarehouse;

  const { data: bomsResponse } = useApiQuery<Bom[]>(['manufacturing-boms'], '/manufacturing/boms');
  const { data: ordersResponse } = useApiQuery<ProductionOrderListRow[]>(
    ['manufacturing-orders'],
    '/manufacturing/orders',
    { limit: 100 }
  );
  const { data: workOrdersResponse } = useApiQuery<
    Array<{
      id: string;
      orderNumber: string;
      status: string;
      bom?: { name: string; finishedItem?: { arabicName?: string } | null };
      modelQuantity: string | number;
      lines?: Array<{ itemId: string; item?: { arabicName?: string } | null }>;
    }>
  >(['manufacturing-work-orders-pick'], '/manufacturing/work-orders', { limit: 150 });

  const boms = bomsResponse?.data ?? [];

  const { data: linkedWorkOrderRes } = useApiQuery<WorkOrderForHydrate>(
    ['manufacturing-work-order', manufacturingWorkOrderId],
    `/manufacturing/work-orders/${manufacturingWorkOrderId}`,
    undefined,
    { enabled: Boolean(manufacturingWorkOrderId) }
  );

  const { data: workOrderProgressRes, refetch: refetchWorkOrderProgress } =
    useApiQuery<WorkOrderProgressSnapshot>(
      ['manufacturing-work-order-progress', manufacturingWorkOrderId],
      `/manufacturing/work-orders/${manufacturingWorkOrderId}/progress`,
      undefined,
      { enabled: Boolean(manufacturingWorkOrderId) }
    );

  const selectableBoms = useMemo(() => {
    if (!manufacturingWorkOrderId || !linkedWorkOrderRes?.data) return boms;
    const allowed = getAllowedBomIds(
      linkedWorkOrderRes.data.processMetadata ?? null,
      linkedWorkOrderRes.data.bomId
    );
    if (allowed.size === 0) return boms;
    const filtered = boms.filter((b) => allowed.has(b.id));
    return filtered.length > 0 ? filtered : boms;
  }, [boms, manufacturingWorkOrderId, linkedWorkOrderRes?.data]);
  const previousOrders = (ordersResponse?.data ?? []).filter((o) => o.status !== 'CANCELLED');
  const workOrdersForPick = useMemo(
    () =>
      (workOrdersResponse?.data ?? []).filter((w) =>
        isWorkOrderSelectableForProductionOrder(w.status)
      ),
    [workOrdersResponse?.data]
  );

  const { data: bomDetailResponse } = useApiQuery<Bom>(
    ['manufacturing-bom', model],
    `/manufacturing/boms/${model}`,
    undefined,
    { enabled: !!model }
  );
  const bom = bomDetailResponse?.data ?? null;

  const { data: itemsResponse } = useApiQuery<
    Array<{ id: string; arabicName: string; averageCost?: string | number | null }>
  >(['inventory-items-mfg-op'], '/inventory/items', { limit: 400 });
  const itemNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of itemsResponse?.data ?? []) map.set(it.id, it.arabicName);
    return map;
  }, [itemsResponse?.data]);

  const itemAverageCostById = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of itemsResponse?.data ?? []) {
      const avg = Number(it.averageCost);
      if (Number.isFinite(avg) && avg > 0) map.set(it.id, avg);
    }
    return map;
  }, [itemsResponse?.data]);

  const resolveItemAverageCost = useCallback(
    (itemId: string) => itemAverageCostById.get(itemId) ?? 0,
    [itemAverageCostById]
  );

  const applyWorkOrderProductDescription = useCallback(
    (wo: WorkOrderFinishedProductSource) => {
      const text = describeWorkOrderFinishedProducts(wo, (id) => itemNameById.get(id));
      if (!text) return;
      setDescription((prev) => {
        if (!prev.trim() || prev === workOrderAutoDescriptionRef.current) {
          workOrderAutoDescriptionRef.current = text;
          return text;
        }
        return prev;
      });
    },
    [itemNameById]
  );

  const workOrderFinishedProductLabel = useCallback(
    (wo: WorkOrderFinishedProductSource) =>
      describeWorkOrderFinishedProducts(wo, (id) => itemNameById.get(id)),
    [itemNameById]
  );

  useEffect(() => {
    if (!manufacturingWorkOrderId || order) return;
    const wo = linkedWorkOrderRes?.data;
    if (!wo || wo.id !== manufacturingWorkOrderId) return;
    applyWorkOrderProductDescription(wo);
  }, [
    manufacturingWorkOrderId,
    linkedWorkOrderRes?.data,
    order,
    applyWorkOrderProductDescription,
  ]);

  const plannedQuantity = Math.max(0, Number(numberOfModels) || 0);
  const scale = bom && num(bom.baseQuantity) > 0 ? plannedQuantity / num(bom.baseQuantity) : 0;

  const bomProgressRow = useMemo(() => {
    if (!model || !manufacturingWorkOrderId) return undefined;
    return workOrderProgressRes?.data?.bomRows?.find((r) => r.bomId === model);
  }, [workOrderProgressRes?.data?.bomRows, model, manufacturingWorkOrderId]);

  const maxManufacturingQty = useMemo(() => {
    if (!manufacturingWorkOrderId || !model || !bomProgressRow) return null;
    const draftOther = sumDraftPlannedForBom(
      previousOrders.map((o) => ({
        id: o.id,
        bomId: o.bomId ?? o.bom?.id,
        status: o.status,
        plannedQuantity: o.plannedQuantity,
        manufacturingWorkOrderId: o.manufacturingWorkOrderId,
      })),
      manufacturingWorkOrderId,
      model,
      order?.id
    );
    return computeMaxManufacturingQuantity(bomProgressRow, {
      currentOrder: order
        ? {
            id: order.id,
            status: order.status,
            plannedQuantity: order.plannedQuantity,
          }
        : null,
      draftReservedOther: draftOther,
    });
  }, [bomProgressRow, manufacturingWorkOrderId, model, previousOrders, order]);

  const workOrderQuantityCapMessage = useMemo(() => {
    if (!bomProgressRow || maxManufacturingQty == null) return null;
    return formatWorkOrderQuantityCapMessage(bomProgressRow, maxManufacturingQty, plannedQuantity);
  }, [bomProgressRow, maxManufacturingQty, plannedQuantity]);

  const quantityExceedsWorkOrderCap =
    maxManufacturingQty != null && plannedQuantity > maxManufacturingQty + 1e-6;

  const draftSnapshot = useMemo<MfgOperationDraft>(
    () => ({
      order,
      serial,
      description,
      date,
      model,
      stage,
      fromWarehouse,
      toWarehouse,
      costCenter,
      operationShiftNumber,
      standardExecutionTime,
      numberOfModels,
      loadedProcess,
    }),
    [
      order,
      serial,
      description,
      date,
      model,
      stage,
      fromWarehouse,
      toWarehouse,
      costCenter,
      operationShiftNumber,
      standardExecutionTime,
      numberOfModels,
      loadedProcess,
    ]
  );

  const applyOperationDraft = useCallback((payload: MfgOperationDraft) => {
    skipDraftApplyRef.current = true;
    setOrder(payload.order);
    setSerial(payload.serial);
    setDescription(payload.description);
    setDate(payload.date);
    setModel(payload.model);
    setStage(payload.stage);
    setFromWarehouse(payload.fromWarehouse);
    setToWarehouse(payload.toWarehouse);
    setCostCenter(payload.costCenter);
    setOperationShiftNumber(payload.operationShiftNumber);
    setStandardExecutionTime(payload.standardExecutionTime);
    setNumberOfModels(payload.numberOfModels);
    setLoadedProcess(payload.loadedProcess);
  }, []);

  const isPostedEarly = !!order && POSTED_STATUSES.includes(order.status);

  const { clearDraft } = useDraftAutosave({
    documentType: 'manufacturing-operation',
    mode: order?.id ? 'edit' : 'new',
    documentId: order?.id ?? null,
    value: draftSnapshot,
    enabled: !isPostedEarly,
    applyRestore: applyOperationDraft,
    isEmpty: isMfgOperationDraftEmpty,
    restoreMessage: 'تم استعادة مسودة أمر التصنيع',
  });

  const applyLoadedProcessHeaderFields = useCallback(
    (loaded: LoadedManufacturingProcess, activeBom?: BomForProcess | null) => {
      if (loaded.stage) setStage(loaded.stage);
      else if (activeBom?.formMetadata?.stage) {
        setStage(String(activeBom.formMetadata.stage));
      }
      if (loaded.fromWarehouseId) setFromWarehouse(loaded.fromWarehouseId);
      if (loaded.toWarehouseId) setToWarehouse(loaded.toWarehouseId);
      if (loaded.costCenter) setCostCenter(loaded.costCenter);
    },
    []
  );

  const finalizeLoadedFromBom = useCallback(
    (activeBom: Bom, qty: number): LoadedManufacturingProcess | null => {
      const built = buildLoadedProcessFromBom(activeBom, qty);
      if (!built) return null;
      built.outputs = built.outputs.map((o) => ({
        ...o,
        itemName: itemNameById.get(o.itemId) ?? o.itemName,
      }));
      built.raws = built.raws.map((r) => ({
        ...r,
        itemName: itemNameById.get(r.itemId) ?? r.itemName,
      }));
      return enrichLoadedProcessWithItemCosts(built, resolveItemAverageCost);
    },
    [itemNameById, resolveItemAverageCost]
  );

  function applyLoadedFromBom(activeBom: Bom, qty: number, successMessage: string) {
    const loaded = finalizeLoadedFromBom(activeBom, qty);
    if (!loaded) return false;
    setLoadedProcess(loaded);
    applyLoadedProcessHeaderFields(loaded, activeBom);
    const execTime = activeBom.formMetadata?.standardExecutionTime;
    if (execTime != null && Number.isFinite(Number(execTime))) {
      setStandardExecutionTime(String(execTime));
    }
    setSuccess(successMessage);
    return true;
  }

  useEffect(() => {
    if (!model || order || loadedProcess) return;
    const execTime = bom?.formMetadata?.standardExecutionTime;
    if (execTime != null && Number.isFinite(Number(execTime))) {
      setStandardExecutionTime(String(execTime));
    }
  }, [model, bom?.formMetadata?.standardExecutionTime, order, loadedProcess]);

  function handleLoadFromModel() {
    resetFeedback();
    if (!model) {
      setError('اختر نموذج التصنيع');
      return;
    }
    if (plannedQuantity <= 0) {
      setError('أدخل عدد النماذج');
      return;
    }
    const capErr = workOrderQuantityCapError();
    if (capErr) {
      setError(capErr);
      return;
    }
    if (manufacturingWorkOrderId.trim()) {
      void loadFromWorkOrder(manufacturingWorkOrderId, model);
      return;
    }
    if (!bom) {
      setError('اختر نموذج التصنيع');
      return;
    }
    if (!applyLoadedFromBom(bom, plannedQuantity, 'تم تحميل بيانات نموذج التصنيع')) {
      setError('تعذر تحميل النموذج');
    }
  }

  function selectOpenWorkOrder(workOrderId: string) {
    if (!workOrderId) {
      setManufacturingWorkOrderId('');
      setLinkedWorkOrderNumber('');
      workOrderAutoDescriptionRef.current = '';
      return;
    }
    const row = workOrdersForPick.find((w) => w.id === workOrderId);
    setManufacturingWorkOrderId(workOrderId);
    setLinkedWorkOrderNumber(row?.orderNumber ?? '');
    if (row) applyWorkOrderProductDescription(row);
    setModel('');
    setLoadedProcess(null);
    setShowWorkOrderPicker(false);
    resetFeedback();
    setSuccess('اختر نموذج التصنيع من القائمة ثم «تحميل»');
  }

  const planPrefillPendingRef = useRef(false);
  useEffect(() => {
    if (skipDraftApplyRef.current) {
      skipDraftApplyRef.current = false;
      return;
    }
    if (order) return;
    const prefill = consumeMfgOperationPrefill();
    if (!prefill?.bomId) return;
    planPrefillPendingRef.current = true;
    setModel(prefill.bomId);
    if (prefill.stage) setStage(prefill.stage);
    if (prefill.fromWarehouseId) setFromWarehouse(prefill.fromWarehouseId);
    if (prefill.toWarehouseId) setToWarehouse(prefill.toWarehouseId);
    if (prefill.costCenter) setCostCenter(prefill.costCenter);
    setNumberOfModels(String(prefill.numberOfModels || 1));
    if (prefill.description) setDescription(prefill.description);
    if (prefill.operationShiftNumber) setOperationShiftNumber(prefill.operationShiftNumber);
    if (prefill.manufacturingWorkOrderId) {
      setManufacturingWorkOrderId(prefill.manufacturingWorkOrderId);
    }
  }, [order]);

  useEffect(() => {
    if (!planPrefillPendingRef.current || !bom || order) return;
    const qty = Math.max(0, Number(numberOfModels) || 0);
    if (qty <= 0) return;
    planPrefillPendingRef.current = false;
    applyLoadedFromBom(bom, qty, 'تم فتح العملية من خطة التصنيع — راجع البيانات واحفظ');
  }, [bom, numberOfModels, order]);

  useEffect(() => {
    if (!processReloadPendingRef.current || !model || !bom || order) return;
    const qty = plannedQuantity;
    if (qty <= 0) return;
    processReloadPendingRef.current = false;

    const wo = linkedWorkOrderRes?.data;
    if (manufacturingWorkOrderId && wo?.id === manufacturingWorkOrderId) {
      const hydrated = hydrateLoadedProcessFromWorkOrder(
        wo,
        bom,
        qty,
        (id) => itemNameById.get(id)
      );
      if (hydrated) {
        const enriched = enrichLoadedProcessWithItemCosts(hydrated, resolveItemAverageCost);
        setLoadedProcess(enriched);
        applyLoadedProcessHeaderFields(enriched, bom);
        const execTime = bom.formMetadata?.standardExecutionTime;
        if (execTime != null && Number.isFinite(Number(execTime))) {
          setStandardExecutionTime(String(execTime));
        }
        return;
      }
    }

    const enriched = finalizeLoadedFromBom(bom, qty);
    if (enriched) {
      setLoadedProcess(enriched);
      applyLoadedProcessHeaderFields(enriched, bom);
      const execTime = bom.formMetadata?.standardExecutionTime;
      if (execTime != null && Number.isFinite(Number(execTime))) {
        setStandardExecutionTime(String(execTime));
      }
    }
  }, [
    model,
    bom,
    order,
    plannedQuantity,
    manufacturingWorkOrderId,
    linkedWorkOrderRes?.data,
    finalizeLoadedFromBom,
    resolveItemAverageCost,
    itemNameById,
    applyLoadedProcessHeaderFields,
  ]);

  const laborCost = loadedProcess?.laborCost ?? num(bom?.standardLaborCost) * scale;
  const overheadCost = loadedProcess?.overheadCost ?? num(bom?.standardOverheadCost) * scale;

  const processForCostEstimate = useMemo(() => {
    if (loadedProcess) return loadedProcess;
    if (!bom || plannedQuantity <= 0) return null;
    return buildLoadedProcessFromBom(bom, plannedQuantity);
  }, [loadedProcess, bom, plannedQuantity]);

  const estimatedProcessCosts = useMemo(() => {
    if (!processForCostEstimate) {
      return { materials: 0, additional: 0, labor: 0, overhead: 0 };
    }
    const materialsFromLines = processForCostEstimate.raws.reduce(
      (sum, row) => sum + (Number(row.lineTotal) || 0),
      0
    );
    const materials =
      materialsFromLines > 0
        ? materialsFromLines
        : computeRawMaterialsTotal(
            processForCostEstimate.raws.map((r) => ({
              quantity: r.quantity,
              scrapPercentage: 0,
              unitPrice: r.unitPrice,
              manufacturedItemId: r.manufacturedItemId || undefined,
            }))
          );
    const additional = computeAdditionalCostsTotal(
      processForCostEstimate.additionalCosts.map((c) => ({
        value: c.value,
        manufacturedItemId: c.manufacturedItemId || undefined,
      }))
    );
    return {
      materials,
      additional,
      labor: Number(processForCostEstimate.laborCost) || 0,
      overhead: Number(processForCostEstimate.overheadCost) || 0,
    };
  }, [processForCostEstimate]);

  const materialCostFromOrder = num(order?.totalMaterialCost);
  const materialCost =
    materialCostFromOrder > 0 ? materialCostFromOrder : estimatedProcessCosts.materials;

  const emptyProcessSeed = useCallback(
    () =>
      createEmptyLoadedProcess({
        stage,
        fromWarehouseId: fromWarehouse,
        toWarehouseId: toWarehouse || fromWarehouse,
        costCenter,
        laborCost,
        overheadCost,
        distributeCostByUnits: Boolean(bom?.formMetadata?.distributeCostByUnits),
      }),
    [stage, fromWarehouse, toWarehouse, costCenter, laborCost, overheadCost, bom?.formMetadata?.distributeCostByUnits]
  );

  const costSlices = useMemo(() => {
    const palette = ['#0d9488', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];
    const materials = materialCost > 0 ? materialCost : estimatedProcessCosts.materials;
    const labor =
      num(order?.totalLaborCost) > 0
        ? num(order?.totalLaborCost)
        : laborCost > 0
          ? laborCost
          : estimatedProcessCosts.labor;
    const overhead =
      num(order?.totalOverheadCost) > 0
        ? num(order?.totalOverheadCost)
        : overheadCost > 0
          ? overheadCost
          : estimatedProcessCosts.overhead;
    const slices: Array<{ id: string; label: string; value: number; color: string }> = [
      { id: 'materials', label: 'المواد الخام', value: materials, color: '#0E78AA' },
      { id: 'labor', label: 'أجور مباشرة', value: labor, color: '#38bdf8' },
      { id: 'overhead', label: 'مصاريف صناعية', value: overhead, color: '#94a3b8' },
    ];
    (processForCostEstimate?.additionalCosts ?? []).forEach((line, index) => {
      const value = Number(line.value) || 0;
      const hasRow =
        value > 0 ||
        line.accountId.trim() ||
        line.accountLabel.trim() ||
        line.description.trim();
      if (!hasRow) return;
      const accountName =
        line.accountLabel.trim() || line.description.trim() || `تكلفة إضافية ${index + 1}`;
      const mfgId = line.manufacturedItemId.trim();
      const mfgName = mfgId ? itemNameById.get(mfgId) : '';
      const label = mfgName ? `${accountName} (${mfgName})` : accountName;
      slices.push({
        id: `additional-${index}`,
        label,
        value,
        color: palette[index % palette.length],
      });
    });
    return slices;
  }, [
    materialCost,
    estimatedProcessCosts,
    laborCost,
    overheadCost,
    processForCostEstimate?.additionalCosts,
    order?.totalLaborCost,
    order?.totalOverheadCost,
    itemNameById,
  ]);

  const createOrderMutation = useApiMutation<{ data: ProductionOrder }, Record<string, unknown>>(
    '/manufacturing/orders',
    'POST',
    {
      onSuccess: (res) => {
        const created = (res as unknown as { data: ProductionOrder }).data;
        setOrder(created);
        setSerial(created.orderNumber);
        setSuccess('تم حفظ وتأكيد أمر التصنيع');
        clearDraft();
        invalidateNextSerial();
        unlockForEdit();
        invalidateQuery(['manufacturing-orders']);
        if (manufacturingWorkOrderId) {
          invalidateQuery(['manufacturing-work-order-progress', manufacturingWorkOrderId]);
          void refetchWorkOrderProgress();
        }
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر حفظ أمر التصنيع'),
    }
  );

  const updateOrderMutation = useApiMutation<ProductionOrder, Record<string, unknown>>(
    order?.id ? `/manufacturing/orders/${order.id}` : '/manufacturing/orders',
    'PUT',
    {
      onSuccess: (res) => {
        const updated = res.data;
        if (!updated) return;
        setOrder(updated);
        setSerial(updated.orderNumber);
        setSuccess('تم تحديث أمر التصنيع');
        invalidateQuery(['manufacturing-orders']);
        if (manufacturingWorkOrderId) {
          invalidateQuery(['manufacturing-work-order-progress', manufacturingWorkOrderId]);
          void refetchWorkOrderProgress();
        }
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر تحديث أمر التصنيع'),
    }
  );

  function workOrderQuantityCapError(): string | null {
    if (!manufacturingWorkOrderId || !model || maxManufacturingQty == null) return null;
    if (plannedQuantity <= maxManufacturingQty + 1e-6) return null;
    return (
      workOrderQuantityCapMessage ??
      `الكمية تتجاوز المتبقي من أمر الشغل (الحد الأقصى ${maxManufacturingQty.toLocaleString('ar-EG')})`
    );
  }

  function resetFeedback() {
    setError(null);
    setSuccess(null);
  }

  async function loadFromWorkOrder(workOrderId: string, bomIdOverride?: string) {
    resetFeedback();
    setBusy(true);
    try {
      const { workOrder, bom: woBom, bomId: activeBomId } = await fetchWorkOrderAndBom(
        workOrderId,
        bomIdOverride
      );
      if (workOrder.status === 'CANCELLED') {
        setError('أمر الشغل ملغي');
        return;
      }
      if (workOrder.status === 'CLOSED') {
        setError('أمر الشغل مغلق — اختر أمراً مفتوحاً');
        return;
      }
      setManufacturingWorkOrderId(workOrder.id);
      setLinkedWorkOrderNumber(workOrder.orderNumber);
      setModel(activeBomId);
      const bomPlan = getBomPlan(workOrder.processMetadata ?? null, activeBomId);
      const manufacturingQty =
        plannedQuantity > 0
          ? plannedQuantity
          : Number(bomPlan?.modelCount ?? workOrder.modelQuantity ?? 1);
      const qty = manufacturingQty > 0 ? manufacturingQty : 1;
      setNumberOfModels(String(qty));
      applyWorkOrderProductDescription(workOrder);
      const loaded = hydrateLoadedProcessFromWorkOrder(
        workOrder,
        woBom,
        qty,
        (id) => itemNameById.get(id)
      );
      if (!loaded) {
        setError('أمر الشغل فارغ — افتح أمر الشغل واختر نماذج التصنيع ثم احفظ');
        setLoadedProcess(null);
        return;
      }
      const enriched = enrichLoadedProcessWithItemCosts(loaded, resolveItemAverageCost);
      setLoadedProcess(enriched);
      applyLoadedProcessHeaderFields(enriched, woBom);
      const execTime = woBom.formMetadata?.standardExecutionTime;
      if (execTime != null && Number.isFinite(Number(execTime))) {
        setStandardExecutionTime(String(execTime));
      }
      setSuccess(`تم تحميل أمر الشغل ${workOrder.orderNumber}`);
      void refetchWorkOrderProgress();
      setShowWorkOrderPicker(false);
    } catch (err) {
      setError((err as ApiError).message || 'تعذر تحميل أمر الشغل');
    } finally {
      setBusy(false);
    }
  }

  function applyOrderToForm(source: ProductionOrder, mode: 'open' | 'copy') {
    const meta = (source.processMetadata ?? {}) as Record<string, unknown>;
    setManufacturingWorkOrderId(source.manufacturingWorkOrderId ?? '');
    setLinkedWorkOrderNumber(source.manufacturingWorkOrder?.orderNumber ?? '');
    setModel(source.bomId);
    setFromWarehouse(source.warehouseIdRaw);
    setToWarehouse(source.warehouseIdFinished);
    setNumberOfModels(String(source.plannedQuantity ?? '1'));
    setStage(typeof meta.stage === 'string' ? meta.stage : '');
    setCostCenter(typeof meta.costCenter === 'string' ? meta.costCenter : '');
    setOperationShiftNumber(
      typeof meta.operationShiftNumber === 'string' ? meta.operationShiftNumber : ''
    );
    setStandardExecutionTime(
      meta.standardExecutionTime != null && Number.isFinite(Number(meta.standardExecutionTime))
        ? String(meta.standardExecutionTime)
        : ''
    );
    if (mode === 'open') {
      setOrder(source);
      setSerial(source.orderNumber);
      setDescription(processMetaDescription(meta));
      unlockForEdit();
    } else {
      setOrder(null);
      setSerial('');
      setDescription(processMetaDescription(meta) || `من أمر ${source.orderNumber}`);
      setSuccess('تم تحميل بيانات الأمر السابق — عدّل واحفظ كأمر جديد');
      unlockForEdit();
    }
  }

  async function hydrateLoadedProcessForOrder(source: ProductionOrder) {
    const qty = Number(source.plannedQuantity);
    if (!source.bomId || !Number.isFinite(qty) || qty <= 0) return;
    try {
      const res = await apiClient.get<Bom>(`/manufacturing/boms/${source.bomId}`);
      const meta = (source.processMetadata ?? {}) as Record<string, unknown>;
      const loaded = buildLoadedProcessFromOrderMetadata(
        meta,
        res.data,
        qty,
        (id) => itemNameById.get(id)
      );
      if (!loaded) {
        setLoadedProcess(null);
        return;
      }
      loaded.outputs = loaded.outputs.map((o) => ({
        ...o,
        itemName: itemNameById.get(o.itemId) ?? o.itemName,
      }));
      loaded.raws = loaded.raws.map((r) => ({
        ...r,
        itemName: itemNameById.get(r.itemId) ?? r.itemName,
      }));
      setLoadedProcess(loaded);
    } catch {
      setLoadedProcess(null);
    }
  }

  async function openPreviousOrder(orderId: string) {
    resetFeedback();
    setShowPreviousDrawer(false);
    setBusy(true);
    try {
      const res = await apiClient.get<ProductionOrder>(`/manufacturing/orders/${orderId}`);
      applyOrderToForm(res.data, 'open');
      await hydrateLoadedProcessForOrder(res.data);
    } catch (err) {
      setError((err as ApiError).message || 'تعذر فتح الأمر');
    } finally {
      setBusy(false);
    }
  }

  const deepLinkOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    const id = searchParams.get('orderId')?.trim();
    if (!id || deepLinkOpenedRef.current === id) return;
    deepLinkOpenedRef.current = id;
    void openPreviousOrder(id);
  }, [searchParams]);

  useEffect(() => {
    const woId = searchParams.get('workOrderId')?.trim();
    if (!woId || order) return;
    const bomId = searchParams.get('bomId')?.trim();
    const qty =
      searchParams.get('modelCount')?.trim() ||
      searchParams.get('numberOfModels')?.trim() ||
      '';
    const key = `${woId}:${bomId ?? ''}:${qty}`;
    if (workOrderDeepLinkRef.current === key) return;
    workOrderDeepLinkRef.current = key;
    if (bomId) setModel(bomId);
    if (qty) setNumberOfModels(qty);
    void loadFromWorkOrder(woId, bomId || undefined);
  }, [searchParams, order]);

  async function loadOrderAsNewDraft(orderId: string) {
    resetFeedback();
    setShowPreviousDrawer(false);
    setBusy(true);
    try {
      const res = await apiClient.get<ProductionOrder>(`/manufacturing/orders/${orderId}`);
      applyOrderToForm(res.data, 'copy');
      await hydrateLoadedProcessForOrder(res.data);
    } catch (err) {
      setError((err as ApiError).message || 'تعذر تحميل الأمر');
    } finally {
      setBusy(false);
    }
  }

  async function ensureRawStockAllowsPost(): Promise<boolean> {
    if (!preventNegativeStock) return true;
    const raws = loadedProcess?.raws ?? [];
    if (!raws.length) {
      setError('اضغط «تحميل» لجلب الخامات قبل الحفظ أو الترحيل');
      return false;
    }
    if (!fromWarehouse) {
      setError('اختر مخزن الخامات (من مخزن)');
      return false;
    }
    const shortages = await findMfgRawStockShortages(raws, fromWarehouse);
    if (!shortages.length) return true;
    setError(
      `لا يمكن المتابعة — رصيد الخامات لا يكفي (مخزون سالب غير مسموح). ${formatMfgShortageBlock(shortages)}. لتفعيل العمل بالسالب: `
    );
    return false;
  }

  async function persistOrder(): Promise<ProductionOrder | null> {
    if (!model) {
      setError('اختر النموذج (قائمة المواد) أولاً');
      return null;
    }
    if (!fromWarehouse) {
      setError('اختر مخزن الخامات');
      return null;
    }
    if (plannedQuantity <= 0) {
      setError('أدخل عدد النماذج');
      return null;
    }
    const capErr = workOrderQuantityCapError();
    if (capErr) {
      setError(capErr);
      return null;
    }
    if (!loadedProcess || !processHasLineContent(loadedProcess)) {
      setError('اضغط «تحميل» من النموذج أو أدخل أصنافاً ناتجة/خامات يدوياً');
      return null;
    }
    if (!(await ensureRawStockAllowsPost())) return null;

    const processMetadata = {
      description: description.trim() || undefined,
      ...(loadedProcess
        ? {
          stage: loadedProcess.stage,
          costCenter: loadedProcess.costCenter,
          operationShiftNumber: operationShiftNumber.trim() || undefined,
          standardExecutionTime: standardExecutionTime.trim()
            ? Number(standardExecutionTime)
            : undefined,
          distributeCostByUnits: loadedProcess.distributeCostByUnits,
          laborCost: loadedProcess.laborCost,
          overheadCost: loadedProcess.overheadCost,
          additionalCosts: loadedProcess.additionalCosts
            .filter((c) => c.accountId || c.accountLabel || c.value > 0)
            .map((c) => ({
              accountId: c.accountId || undefined,
              accountLabel: c.accountLabel,
              value: c.value,
              valuePercent: c.valuePercent,
              description: c.description,
              costCenter: c.costCenter,
              manufacturedItemId: c.manufacturedItemId || undefined,
            })),
          outputLinesSnapshot: loadedProcess.outputs
            .filter((o) => o.itemId.trim())
            .map((o) => ({
              itemId: o.itemId,
              itemName: o.itemName,
              quantity: o.quantity,
              unit: o.unit,
              unitPrice: o.unitPrice,
              lineTotal: o.lineTotal,
              costPercent: o.costPercent,
              warehouseId: o.warehouseId || undefined,
            })),
          rawLinesSnapshot: loadedProcess.raws
            .filter((r) => r.itemId.trim())
            .map((r) => ({
              rawItemId: r.itemId,
              itemName: r.itemName,
              quantity: r.quantity,
              unitPrice: r.unitPrice,
              lineTotal: r.lineTotal,
              scrapPercentage: 0,
              warehouseId: r.warehouseId || undefined,
              manufacturedItemId: r.manufacturedItemId || undefined,
            })),
          varianceExtras: loadedProcess.varianceExtras,
          varianceActualOverrides: loadedProcess.varianceActualOverrides,
        }
        : {}),
    };

    const body = {
      orderNumber: serialAutomatic && !order?.id ? undefined : serial.trim() || undefined,
      bomId: model,
      manufacturingWorkOrderId: manufacturingWorkOrderId.trim() || undefined,
      plannedQuantity,
      warehouseIdRaw: fromWarehouse,
      warehouseIdFinished: toWarehouse || fromWarehouse,
      processMetadata,
    };

    if (order?.id) {
      if (!body.orderNumber) {
        setError('أدخل مسلسل الأمر');
        return null;
      }
      setBusy(true);
      try {
        const res = await updateOrderMutation.mutateAsync(body);
        return res.data ?? order;
      } finally {
        setBusy(false);
      }
    }

    setBusy(true);
    try {
      const res = await createOrderMutation.mutateAsync(body);
      const created = (res as unknown as { data: ProductionOrder }).data;
      return created ?? null;
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    resetFeedback();
    await persistOrder();
  }

  async function openTransfer(kind: 'raw' | 'finished', quantityMode: 'full' | 'shortage' = 'full') {
    resetFeedback();
    if (!loadedProcess) {
      setError('اضغط «تحميل» لجلب بيانات النموذج أولاً');
      return;
    }
    const fromWh = fromWarehouse || loadedProcess.fromWarehouseId;
    const toWh = toWarehouse || loadedProcess.toWarehouseId;
    if (!fromWh || !toWh) {
      setError('حدد مخزن المصدر ومخزن الوجهة (من / إلى)');
      return;
    }
    if (fromWh === toWh) {
      setError('مخزن المصدر والوجهة متطابقان — اختر مخزنين مختلفين للنقل');
      return;
    }

    let lines: Array<{ itemId: string; quantity: number; itemName?: string }> = [];
    if (kind === 'raw') {
      const rawRows = loadedProcess.raws.map((r) => ({
        itemId: r.itemId,
        quantity: r.quantity,
        itemName: r.itemName,
        warehouseId: r.warehouseId || fromWh,
      }));
      if (quantityMode === 'shortage') {
        setBusy(true);
        try {
          lines = await buildShortageTransferLines(rawRows, fromWh);
          if (lines.length === 0) {
            setError('لا يوجد عجز — الرصيد في مخزن المصدر يغطي الكميات المطلوبة');
            return;
          }
        } catch (err) {
          setError(shortageTransferError(err));
          return;
        } finally {
          setBusy(false);
        }
      } else {
        lines = rawRows.map((r) => ({
          itemId: r.itemId,
          quantity: r.quantity,
          itemName: r.itemName,
        }));
      }
    } else {
      lines = loadedProcess.outputs.map((o) => ({
        itemId: o.itemId,
        quantity: o.quantity,
        itemName: o.itemName,
      }));
    }

    if (lines.length === 0) {
      setError(kind === 'raw' ? 'لا توجد خامات للتحويل' : 'لا توجد أصناف ناتجة للتحويل');
      return;
    }

    stashMfgTransferPrefill({
      description:
        quantityMode === 'shortage'
          ? `نقل عجز خامات — عملية تصنيع`
          : `تحويل ${kind === 'raw' ? 'مواد خام' : 'منتجات'} — عملية تصنيع`,
      fromWarehouseId: fromWh,
      toWarehouseId: toWh,
      lines,
      returnHref: '/manufacturing/operations/operation',
      returnLabel: 'أمر التصنيع',
      shortageOnly: quantityMode === 'shortage',
    });
    setShowTransferPick(false);
    setShowQtyCheck(false);
    router.push('/inventory/operations/transfer');
  }

  async function handlePost() {
    resetFeedback();
    if (!order) return setError('احفظ أمر التصنيع قبل الترحيل');
    let activeOrder = order;
    if (canEditOrder && loadedProcess && processHasLineContent(loadedProcess)) {
      const saved = await persistOrder();
      if (!saved) return;
      activeOrder = saved;
    }
    if (!(await ensureRawStockAllowsPost())) return;
    setBusy(true);
    try {
      const issued = await apiClient.post<ProductionOrder>(
        `/manufacturing/orders/${activeOrder.id}/issue-materials`
      );
      setOrder(issued.data);

      if (laborCost > 0 || overheadCost > 0) {
        const withCosts = await apiClient.post<ProductionOrder>(
          `/manufacturing/orders/${issued.data.id}/add-costs`,
          { laborCost, overheadCost }
        );
        setOrder(withCosts.data);
      }
      setSuccess('تم بدء التنفيذ — صرف الخامات من المخزن والقيد المحاسبي');
    } catch (err) {
      setError((err as ApiError).message || 'تعذر بدء التنفيذ');
    } finally {
      setBusy(false);
    }
  }

  const orderLocked = !!order && order.status === 'CANCELLED';
  const orderExecutionLocked =
    !!order &&
    (order.status === 'IN_PROGRESS' ||
      order.status === 'COMPLETED' ||
      Boolean(order.materialsIssueJournalEntryId));

  const canEditOrder = !order || (order.status !== 'CANCELLED' && !orderExecutionLocked);

  const fieldsDisabled = !canEditOrder;

  async function handleCancelOrder() {
    if (!order?.id) return;
    resetFeedback();
    setBusy(true);
    try {
      const res = await apiClient.post<ProductionOrder>(`/manufacturing/orders/${order.id}/cancel`);
      setOrder(res.data);
      setSuccess('تم إلغاء أمر التصنيع');
      lockToView();
      invalidateQuery(['manufacturing-orders']);
    } catch (err) {
      setError((err as ApiError).message || 'تعذر إلغاء الأمر');
    } finally {
      setBusy(false);
    }
  }

  function handleNewOrder() {
    clearDraft();
    setOrder(null);
    setSerial('');
    setLoadedProcess(null);
    setDescription('');
    resetFeedback();
    unlockForEdit();
    invalidateNextSerial();
  }

  async function handleComplete() {
    resetFeedback();
    if (!order) return setError('احفظ أمر التصنيع قبل الإنهاء');
    setBusy(true);
    try {
      const finishedItemId = bom?.finishedItemId;
      const primaryOutput =
        loadedProcess?.outputs.find((o) => o.itemId === finishedItemId) ??
        loadedProcess?.outputs.find((o) => o.itemId.trim());
      const actualQuantity = primaryOutput?.quantity ?? plannedQuantity;
      if (!Number.isFinite(actualQuantity) || actualQuantity <= 0) {
        setError('كمية الصنف الناتج غير صالحة للإنهاء');
        return;
      }
      const completed = await apiClient.post<ProductionOrder>(
        `/manufacturing/orders/${order.id}/complete`,
        { actualQuantity }
      );
      setOrder(completed.data);
      if (manufacturingWorkOrderId) {
        invalidateQuery(['manufacturing-work-order-progress', manufacturingWorkOrderId]);
        void refetchWorkOrderProgress();
      }
      setSuccess('تم إنهاء الأمر — استلام المنتجات في مخزن المواد النهائية والقيد');
    } catch (err) {
      setError((err as ApiError).message || 'تعذر إنهاء التصنيع');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ManufacturingPageChrome
      title="أمر التصنيع"
      statusLabel={order ? statusLabel(order.status) : 'جديد'}
      statusTone={
        order?.status === 'COMPLETED'
          ? 'success'
          : order?.status === 'CANCELLED'
            ? 'danger'
            : order
              ? 'info'
              : 'neutral'
      }
      docNumber={serial || order?.orderNumber}
      currentId={order?.id ?? null}
      favoriteHref="/manufacturing/operations/operation"
      onSave={() => void handleSave()}
      savePending={createOrderMutation.isPending || updateOrderMutation.isPending || busy}
      canSave={
        canEditOrder &&
        Boolean(model && fromWarehouse && loadedProcess && processHasLineContent(loadedProcess))
      }
      saveLabel={order?.id ? 'تحديث الأمر' : 'حفظ أمر التصنيع'}
      saveDisabledHint={
        orderLocked
          ? 'لا يمكن تعديل أمر ملغي — افتح أمرًا جديدًا'
          : orderExecutionLocked
            ? 'لا يمكن تعديل أمر بعد بدء التنفيذ'
            : undefined
      }
      onBrowseList={() => setShowPreviousDrawer(true)}
      standardActions={{
        hasDocument: Boolean(order?.id),
        isPosted: orderLocked || orderExecutionLocked,
        isCancelled: order?.status === 'CANCELLED',
        onNew: handleNewOrder,
        newLabel: 'أمر جديد',
        onEdit: () => unlockForEdit(),
        onDuplicate: order?.id ? () => void loadOrderAsNewDraft(order.id) : undefined,
        duplicateLabel: 'نسخ كمسودة',
        onVoid:
          order?.id && (order.status === 'DRAFT' || order.status === 'RELEASED')
            ? () => void handleCancelOrder()
            : undefined,
        voidLabel: 'إلغاء الأمر',
        hidePostActions: true,
        editLockedHint: orderLocked
          ? 'لا يمكن تعديل أمر ملغي'
          : orderExecutionLocked
            ? 'الأمر قيد التنفيذ أو منتهي — الجداول للعرض فقط'
            : undefined,
      }}
      extraActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void handlePost()}
            disabled={
              !order ||
              busy ||
              order.status === 'IN_PROGRESS' ||
              order.status === 'COMPLETED' ||
              order.status === 'CANCELLED' ||
              Boolean(order.materialsIssueJournalEntryId)
            }
            size="sm"
            className="bg-[#0E78AA] hover:bg-[#0B6188]"
          >
            بدء التنفيذ
          </Button>
          <Button
            onClick={() => void handleComplete()}
            disabled={!order || order.status !== 'IN_PROGRESS' || busy}
            size="sm"
            variant="secondary"
          >
            إنهاء
          </Button>
        </div>
      }
    >
      <DocumentReadOnlyBanner />
      <DocumentBrowseDrawer
        open={showPreviousDrawer}
        onClose={() => setShowPreviousDrawer(false)}
        title="أوامر التصنيع السابقة"
      >
        <p className="mb-3 text-xs text-slate-500">
          «فتح» يعرض الأمر كما هو. «تحميل كمسودة» ينسخ البيانات بمسلسل جديد تحفظه أنت.
        </p>
        <div className="space-y-2">
          {previousOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">لا توجد أوامر سابقة</p>
          ) : (
            previousOrders.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D6EAF3] bg-white px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-[#0A3D5E]">مسلسل: {row.orderNumber}</p>
                  <p className="text-xs text-slate-600">
                    {processMetaDescription(row.processMetadata)
                      ? `الشرح: ${processMetaDescription(row.processMetadata)}`
                      : '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {statusLabel(row.status)}
                    {row.bom?.name ? ` · نموذج: ${row.bom.name}` : ''}
                    {row.finishedItem?.arabicName ? ` · ${row.finishedItem.arabicName}` : ''}
                    {row.finishedItem?.serial ? ` (${row.finishedItem.serial})` : ''}
                    {' · '}
                    كمية: {num(row.plannedQuantity).toLocaleString('ar-EG')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void openPreviousOrder(row.id)}
                  >
                    فتح
                  </Button>
                  <Button type="button" size="sm" onClick={() => void loadOrderAsNewDraft(row.id)}>
                    تحميل كمسودة
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DocumentBrowseDrawer>

      <DocumentBrowseDrawer
        open={showWorkOrderPicker}
        onClose={() => setShowWorkOrderPicker(false)}
        title="اختيار أمر الشغل"
      >
        <p className="mb-3 text-xs text-slate-500">
          أوامر الشغل النشطة (مؤكدة أو قيد التنفيذ). بعد الاختيار حدّد نموذج التصنيع ثم «تحميل».
        </p>
        <div className="space-y-2">
          {workOrdersForPick.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">لا توجد أوامر شغل متاحة</p>
          ) : (
            workOrdersForPick.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D6EAF3] bg-white px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-[#0A3D5E]">مسلسل: {row.orderNumber}</p>
                  <p className="text-xs text-slate-500">
                    {manufacturingWorkOrderStatusLabel(row.status)}
                    {workOrderFinishedProductLabel(row)
                      ? ` · ${workOrderFinishedProductLabel(row)}`
                      : row.bom?.name
                        ? ` · ${row.bom.name}`
                        : ''}
                    {' · '}
                    نماذج: {Number(row.modelQuantity).toLocaleString('ar-EG')}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => selectOpenWorkOrder(row.id)}
                >
                  اختيار
                </Button>
              </div>
            ))
          )}
        </div>
      </DocumentBrowseDrawer>

      <div className="rounded-2xl border border-[#D6EAF3] bg-white p-4 shadow-sm">
        <WorkflowStepper
          steps={[...PRODUCTION_ORDER_WORKFLOW_STEPS]}
          currentIndex={productionOrderWorkflowStepIndex(order?.status)}
        />
      </div>

      <FormSectionCard
        title="بيانات الأمر"
        subtitle="اختر نموذج التصنيع و«تحميل» — أمر الشغل اختياري (يقيّد النماذج والكمية عند الربط)"
        bodyClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      >
        <CompactFormField
          label="المسلسل"
          placeholder={serialAutomatic ? 'يُولَّد تلقائياً (مثل 000001)' : 'ادخل المسلسل'}
          readOnly={serialAutomatic && !order}
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />
        <CompactFormField
          label="التاريخ"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <CompactFormField label="أمر الشغل (اختياري)">
          <div className="flex flex-wrap gap-2">
            <select
              value={manufacturingWorkOrderId}
              disabled={fieldsDisabled || busy}
              onChange={(e) => selectOpenWorkOrder(e.target.value)}
              className={compactControlClass}
            >
              <option value="">بدون أمر شغل</option>
              {workOrdersForPick.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.orderNumber}
                  {workOrderFinishedProductLabel(row)
                    ? ` — ${workOrderFinishedProductLabel(row)}`
                    : row.bom?.name
                      ? ` — ${row.bom.name}`
                      : ''}
                  {` · ${manufacturingWorkOrderStatusLabel(row.status)}`}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={fieldsDisabled || busy}
              onClick={() => setShowWorkOrderPicker(true)}
            >
              بحث
            </Button>
          </div>
          {linkedWorkOrderNumber ? (
            <p className="mt-1 text-xs text-slate-500">المحدد: {linkedWorkOrderNumber}</p>
          ) : null}
        </CompactFormField>
        {manufacturingWorkOrderId ? (
          <div className="flex flex-wrap items-end gap-3">
            <Link
              href={`/manufacturing/operations/production-planning?id=${encodeURIComponent(manufacturingWorkOrderId)}`}
              className="text-sm font-semibold text-[#0E78AA] underline-offset-2 hover:underline"
            >
              نماذج التصنيع
            </Link>
            <Link
              href={`/manufacturing/operations/sales-order?workOrderId=${encodeURIComponent(manufacturingWorkOrderId)}`}
              className="text-sm font-semibold text-[#0E78AA] underline-offset-2 hover:underline"
            >
              أمر البيع / الشغل
            </Link>
          </div>
        ) : null}
        <CompactFormField label="نموذج التصنيع" required>
          <select
            value={model}
            onChange={(e) => {
              const next = e.target.value;
              setModel(next);
              setOrder(null);
              setLoadedProcess(null);
              processReloadPendingRef.current = true;
              const plan = linkedWorkOrderRes?.data
                ? getBomPlan(linkedWorkOrderRes.data.processMetadata ?? null, next)
                : undefined;
              if (plan?.modelCount) {
                const row = workOrderProgressRes?.data?.bomRows?.find((r) => r.bomId === next);
                const draftOther = manufacturingWorkOrderId
                  ? sumDraftPlannedForBom(
                      previousOrders.map((o) => ({
                        id: o.id,
                        bomId: o.bomId ?? o.bom?.id,
                        status: o.status,
                        plannedQuantity: o.plannedQuantity,
                        manufacturingWorkOrderId: o.manufacturingWorkOrderId,
                      })),
                      manufacturingWorkOrderId,
                      next,
                      order?.id
                    )
                  : 0;
                const maxForBom = computeMaxManufacturingQuantity(row, {
                  currentOrder: order
                    ? {
                        id: order.id,
                        status: order.status,
                        plannedQuantity: order.plannedQuantity,
                      }
                    : null,
                  draftReservedOther: draftOther,
                });
                const defaultQty =
                  maxForBom != null ? Math.min(plan.modelCount, maxForBom) : plan.modelCount;
                setNumberOfModels(String(defaultQty > 0 ? defaultQty : plan.modelCount));
              }
            }}
            disabled={fieldsDisabled}
            className={compactControlClass}
          >
            <option value="">اختر النموذج</option>
            {selectableBoms.map((b) => {
              const plan = linkedWorkOrderRes?.data
                ? getBomPlan(linkedWorkOrderRes.data.processMetadata ?? null, b.id)
                : undefined;
              return (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.finishedItem ? ` — ${b.finishedItem.arabicName}` : ''}
                  {plan?.modelCount ? ` · كمية: ${plan.modelCount}` : ''}
                </option>
              );
            })}
          </select>
        </CompactFormField>
        <CompactFormField label="المرحلة" value={stage} onChange={(e) => setStage(e.target.value)} />
        <CompactFormField label="من مخزن (حركة)" required>
          <WarehouseSelect
            value={fromWarehouse}
            onChange={setFromWarehouse}
            disabled={fieldsDisabled}
            className={compactControlClass}
            leafOnly
            emptyLabel="مخزن حركة"
          />
        </CompactFormField>
        <CompactFormField label="إلى مخزن (حركة)">
          <WarehouseSelect
            value={toWarehouse}
            onChange={setToWarehouse}
            disabled={fieldsDisabled}
            className={compactControlClass}
            leafOnly
            emptyLabel="مخزن الإنتاج / الوجهة"
          />
        </CompactFormField>
        <CompactFormField
          label="عدد النماذج"
          type="number"
          min={0}
          step="0.0001"
          value={numberOfModels}
          onChange={(e) => {
            setNumberOfModels(e.target.value);
            processReloadPendingRef.current = true;
          }}
        />
        {workOrderQuantityCapMessage ? (
          <div
            className={cn(
              'rounded-lg border px-3 py-2 text-sm sm:col-span-2 lg:col-span-3',
              quantityExceedsWorkOrderCap
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : 'border-sky-200 bg-sky-50 text-sky-950'
            )}
            role="status"
          >
            {workOrderQuantityCapMessage}
          </div>
        ) : null}
        <CompactFormField
          label="رقم التشغيلة"
          value={operationShiftNumber}
          onChange={(e) => setOperationShiftNumber(e.target.value)}
          placeholder="اختياري"
        />
        <CompactFormField label="مركز التكلفة (حركة)">
          <CostCenterSelect
            value={costCenter}
            onChange={setCostCenter}
            className={compactControlClass}
            allowEmpty
            emptyLabel="مركز تكلفة حركة"
            leafOnly
          />
        </CompactFormField>
        <CompactFormField
          label="الزمن المعياري للتنفيذ"
          type="number"
          min={0}
          step="0.01"
          value={standardExecutionTime}
          onChange={(e) => setStandardExecutionTime(e.target.value)}
          placeholder="ساعات — من النموذج"
          readOnly={fieldsDisabled}
        />
        <CompactFormField
          label="الشرح"
          placeholder="إدخل الشرح"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          readOnly={fieldsDisabled}
        />
        <CompactFormField label="العملة" value="الجنية المصري" readOnly />
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
          <Button
            type="button"
            size="sm"
            className="bg-[#0E78AA] hover:bg-[#0B6188]"
            disabled={fieldsDisabled || !model}
            onClick={handleLoadFromModel}
          >
            تحميل
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={!loadedProcess} onClick={() => setShowQtyCheck(true)}>
            فحص الكميات
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={!loadedProcess} onClick={() => setShowTransferPick(true)}>
            تحويل الكميات
          </Button>
        </div>
        {order ? (
          <>
            <CompactFormField label="رقم الأمر" value={order.orderNumber} readOnly />
            <CompactFormField
              label="القيد (صرف خامات)"
              value={order.materialsIssueJournalEntryId ?? '—'}
              readOnly
            />
          </>
        ) : null}
      </FormSectionCard>

      {(error || success) && (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm text-right',
            error
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-green-200 bg-green-50 text-green-700'
          )}
        >
          {error ?? success}
          {error && error.includes('مخزون سالب غير مسموح') ? (
            <p className="mt-2">
              <Link
                href={COMPANY_NEGATIVE_STOCK_SETTINGS_HREF}
                className="font-semibold text-[#0E78AA] underline"
              >
                إعدادات الشركة — منع المخزون السالب
              </Link>
            </p>
          ) : null}
        </div>
      )}

      <ManufacturingProcessLinesEditor
        process={loadedProcess}
        onProcessChange={setLoadedProcess}
        disabled={fieldsDisabled}
        items={itemsResponse?.data ?? []}
        fromWarehouse={fromWarehouse}
        finishedWarehouseId={finishedWarehouseId}
        bomEditHref={bomEditHref}
        materialCostFromOrder={materialCost}
        emptyProcessSeed={emptyProcessSeed}
      />

      <CostRollupCard slices={costSlices} />

      <ManufacturingQuantityCheckDialog
        open={showQtyCheck}
        onClose={() => setShowQtyCheck(false)}
        rows={loadedProcess?.raws ?? []}
        defaultWarehouseId={fromWarehouse || loadedProcess?.fromWarehouseId || ''}
        onTransferShortages={
          loadedProcess
            ? () => void openTransfer('raw', 'shortage')
            : undefined
        }
        transferShortagesPending={busy}
      />

      {showTransferPick ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-[#0A3D5E]">تحويل الكميات</h3>
            <p className="mt-2 text-sm text-slate-600">
              الحفظ يحفظ مسودة النقل. «حفظ وترحيل» يحرّك المخزون ويُنشئ قيدًا عند الجرد المستمر — تأكد من حسابات المخازن أولاً.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" disabled={busy} onClick={() => void openTransfer('raw', 'shortage')}>
                مواد خام — العجز فقط (غير المتاح)
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void openTransfer('raw', 'full')}>
                مواد خام — الكمية كاملة
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void openTransfer('finished', 'full')}>
                منتجات مصنعة
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowTransferPick(false)}>
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ManufacturingPageChrome>
  );
}
