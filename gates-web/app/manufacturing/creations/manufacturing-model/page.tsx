'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import {
  CompactFormField,
  FormSectionCard,
  compactControlClass,
  CostRollupCard,
  Button,
  Switch,
} from '@/components/ui';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import {
  ManufacturingPageChrome,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgTdIdx,
  mfgTdNum,
  mfgThClass,
  mfgThIdx,
  mfgThItem,
  mfgThMoney,
  mfgThQty,
  mfgThUnit,
  mfgTheadStickyClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';
import { compactNumericControlClass } from '@/app/components/ui/forms/formTokens';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { PageSkeleton } from '@/components/ui/skeletons';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import {
  computeManufacturingCostPool,
  computeRawMaterialsTotal,
  distributeOutputLineCosts,
  sumOutputCostPercents,
} from '@/lib/manufacturing/bom-cost-distribution';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { ItemAlternativesPeek } from '@/components/manufacturing/ItemAlternativesPeek';
import {
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';
import {
  baseUnitLabelForItem,
  baseUnitLinkForItem,
  itemUnitRowsToLinks,
  type ItemUnitLink,
  type ItemWithUnits,
} from '@/lib/inventory/item-units';
import {
  ASSEMBLY_PRICING_METHOD_OPTIONS,
  resolveAssemblyUnitCost,
  type AssemblyPricingMethod,
} from '@/lib/inventory/assembly-pricing';

type ItemRow = ItemWithUnits & {
  id: string;
  arabicName: string;
  serial?: string | null;
  averageCost?: string | number | null;
  lastPurchasePrice?: string | number | null;
};

type RawLine = {
  rawItemId: string;
  quantity: string;
  unit: string;
  scrapPercentage: string;
  unitPrice: string;
  lineDescription: string;
  warehouseId: string;
  manufacturedItemId: string;
};

function parsePricingMethod(value: unknown): AssemblyPricingMethod {
  if (value === 'LAST_PURCHASE' || value === 'MANUAL' || value === 'AVERAGE_COST') return value;
  return 'AVERAGE_COST';
}

function unitPriceForItemByMethod(
  method: AssemblyPricingMethod,
  item: ItemRow | undefined
): string {
  if (method === 'MANUAL') return '0';
  return String(resolveAssemblyUnitCost(method, item ?? null));
}

function unitLabelForItem(item: ItemRow | undefined): string {
  if (!item) return '—';
  const short = baseUnitLinkForItem(item)?.unit?.arabicName?.trim();
  if (short) return short;
  const label = baseUnitLabelForItem(item);
  if (label && label !== '—') return label.split(' (')[0]?.trim() || label;
  return item.serial?.trim() || '—';
}

type OutputLine = {
  itemId: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  costPercent: string;
  description: string;
  warehouseId: string;
};

type AdditionalCostLine = {
  accountId: string;
  accountLabel: string;
  value: string;
  valuePercent: string;
  description: string;
  costCenter: string;
  manufacturedItemId: string;
};

type OutputLinePersisted = {
  itemId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPercent: number;
  description: string;
  warehouseId?: string;
};

type AdditionalCostLinePersisted = {
  accountId?: string;
  accountLabel: string;
  value: number;
  valuePercent: number;
  description: string;
  costCenter: string;
  manufacturedItemId?: string;
};

type BomFormMetadata = {
  distributeCostByUnits?: boolean;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  standardExecutionTime?: number;
  stage?: string;
  description?: string;
  costCenterId?: string;
  costCenter?: string;
  pricingMethod?: AssemblyPricingMethod;
  outputLines?: OutputLinePersisted[];
  additionalCosts?: AdditionalCostLinePersisted[];
  rawLinesSnapshot?: Array<{
    rawItemId: string;
    quantity: number;
    scrapPercentage: number;
    unitPrice: number;
    lineDescription?: string;
    warehouseId?: string;
    manufacturedItemId?: string;
  }>;
};

type BomDetail = {
  id: string;
  name: string;
  finishedItemId: string;
  baseQuantity: string | number;
  standardLaborCost: string | number;
  standardOverheadCost: string | number;
  formMetadata?: BomFormMetadata | null;
  finishedItem?: { id: string; arabicName: string; serial?: string | null };
  lines?: Array<{
    rawItemId: string;
    quantity: string | number;
    scrapPercentage: string | number;
    lineOrder?: number;
    lineDescription?: string | null;
    warehouseId?: string | null;
    manufacturedItemId?: string | null;
  }>;
};

function calcLineQty(quantity: string, scrapPercentage: string): number {
  const qty = Number(quantity);
  const scrap = Number(scrapPercentage) || 0;
  if (!Number.isFinite(qty)) return 0;
  return qty * (1 + scrap / 100);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function additionalValueFromPercent(percent: string, base: number): string {
  const p = Number(percent);
  if (!Number.isFinite(p) || base <= 0) return '0';
  return String(roundMoney(base * (p / 100)));
}

function additionalPercentFromValue(value: string, base: number): string {
  const v = Number(value);
  if (!Number.isFinite(v) || base <= 0) return '0';
  return String(roundMoney((v / base) * 100));
}

function lineTotal(qty: string, price: string): number {
  const q = Number(qty);
  const p = Number(price);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return q * p;
}

function emptyRawLines(): RawLine[] {
  return [
    {
      rawItemId: '',
      quantity: '1',
      unit: '',
      scrapPercentage: '0',
      unitPrice: '0',
      lineDescription: '',
      warehouseId: '',
      manufacturedItemId: '',
    },
  ];
}

function emptyOutputLine(): OutputLine {
  return {
    itemId: '',
    quantity: '1',
    unit: '',
    unitPrice: '0',
    costPercent: '100',
    description: '',
    warehouseId: '',
  };
}

type MfgBomModelDraft = {
  bomId: string | null;
  serial: string;
  modelName: string;
  description: string;
  fromWarehouse: string;
  toWarehouse: string;
  costCenterId: string;
  laborCost: string;
  overheadCost: string;
  stage: string;
  distributeCostByUnits: boolean;
  standardExecutionTime: string;
  pricingMethod: AssemblyPricingMethod;
  rawLines: RawLine[];
  outputLines: OutputLine[];
  additionalCosts: AdditionalCostLine[];
};

function isMfgBomModelDraftEmpty(draft: MfgBomModelDraft): boolean {
  const hasRaw = draft.rawLines.some((l) => l.rawItemId.trim());
  const hasOutput = draft.outputLines.some((o) => o.itemId.trim());
  const hasExtra = draft.additionalCosts.some(
    (c) => c.accountId.trim() || c.accountLabel.trim() || Number(c.value)
  );
  return (
    !draft.bomId &&
    !draft.serial.trim() &&
    !draft.modelName.trim() &&
    !draft.description.trim() &&
    !draft.fromWarehouse &&
    !draft.toWarehouse &&
    !hasRaw &&
    !hasOutput &&
    !hasExtra &&
    draft.laborCost === '0' &&
    draft.overheadCost === '0'
  );
}

function emptyAdditionalCost(): AdditionalCostLine {
  return {
    accountId: '',
    accountLabel: '',
    value: '0',
    valuePercent: '0',
    description: '',
    costCenter: '',
    manufacturedItemId: '',
  };
}

export default function ManufacturingModelPage() {
  return (
    <DocumentModeProvider>
      <ManufacturingModelPageInner />
    </DocumentModeProvider>
  );
}

function ManufacturingModelPageInner() {
  useBackendReachability();
  const { unlockForEdit } = useDocumentMode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateQuery = useInvalidateQuery();

  const idFromUrl = searchParams.get('id')?.trim() || null;
  const [bomId, setBomId] = useState<string | null>(idFromUrl);
  const hydratedRef = useRef<string | null>(null);
  const skipServerHydrateRef = useRef(false);

  const [serial, setSerial] = useState('');
  const [modelName, setModelName] = useState('');
  const [description, setDescription] = useState('');
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [laborCost, setLaborCost] = useState('0');
  const [overheadCost, setOverheadCost] = useState('0');
  const [stage, setStage] = useState('');
  const [distributeCostByUnits, setDistributeCostByUnits] = useState(false);
  const [standardExecutionTime, setStandardExecutionTime] = useState('');
  const [pricingMethod, setPricingMethod] = useState<AssemblyPricingMethod>('AVERAGE_COST');
  const [rawLines, setRawLines] = useState<RawLine[]>(emptyRawLines);
  const [outputLines, setOutputLines] = useState<OutputLine[]>([emptyOutputLine()]);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCostLine[]>([emptyAdditionalCost()]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreviousDrawer, setShowPreviousDrawer] = useState(false);

  useEffect(() => {
    setBomId(idFromUrl);
    if (!idFromUrl) hydratedRef.current = null;
  }, [idFromUrl]);

  const openBom = (id: string | null) => {
    setBomId(id);
    if (id) router.replace(`/manufacturing/creations/manufacturing-model?id=${encodeURIComponent(id)}`, { scroll: false });
    else router.replace('/manufacturing/creations/manufacturing-model', { scroll: false });
  };

  const { data: itemsResponse } = useApiQuery<ItemRow[]>(
    ['inventory-items-bom'],
    '/inventory/items',
    { limit: 500, isActive: true }
  );
  const items = itemsResponse?.data ?? [];

  const itemById = useMemo(() => {
    const map = new Map<string, ItemRow>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const [itemUnitsById, setItemUnitsById] = useState<Record<string, ItemUnitLink[]>>({});

  const itemRowForUnit = useCallback(
    (itemId: string): ItemRow | undefined => {
      const base = itemById.get(itemId);
      const extra = itemUnitsById[itemId];
      if (!extra?.length) return base;
      if (!base) return { id: itemId, arabicName: '', units: extra };
      if (base.units?.length) return base;
      return { ...base, units: extra };
    },
    [itemById, itemUnitsById]
  );

  const unitsFetchStartedRef = useRef(new Set<string>());

  const ensureItemUnitsLoaded = useCallback(
    async (itemId: string): Promise<string> => {
      if (!itemId) return '—';
      const fromList = itemById.get(itemId);
      const listed = unitLabelForItem(fromList);
      if (listed !== '—') return listed;
      if (unitsFetchStartedRef.current.has(itemId)) return '—';
      unitsFetchStartedRef.current.add(itemId);
      try {
        const res = await apiClient.get<
          Array<{
            unitId: string;
            isBaseUnit?: boolean;
            conversionFactor?: number | string | null;
            isFactorFixed?: boolean | null;
            unit?: { id: string; code?: string | null; arabicName?: string };
          }>
        >('/inventory/item-units', { itemId, limit: 50 });
        const links = itemUnitRowsToLinks(res.data ?? []);
        if (links.length) {
          setItemUnitsById((prev) => (prev[itemId] ? prev : { ...prev, [itemId]: links }));
          return unitLabelForItem({ ...fromList, id: itemId, units: links } as ItemRow);
        }
        return '—';
      } catch {
        unitsFetchStartedRef.current.delete(itemId);
        return '—';
      }
    },
    [itemById]
  );

  const { data: bomListResponse } = useApiQuery<
    Array<{
      id: string;
      name: string;
      baseQuantity?: string | number;
      finishedItem?: { id: string; arabicName: string; serial?: string | null };
    }>
  >(['manufacturing-boms'], '/manufacturing/boms');
  const bomList = bomListResponse?.data ?? [];

  const { data: bomDetailResponse, isLoading: bomLoading } = useApiQuery<BomDetail>(
    ['manufacturing-bom', bomId],
    `/manufacturing/boms/${bomId}`,
    undefined,
    { enabled: Boolean(bomId) }
  );
  const bomDetail = bomDetailResponse?.data ?? null;

  function applyBomDetailToForm(bomDetail: BomDetail) {
    const meta = (bomDetail.formMetadata ?? {}) as BomFormMetadata;
    setModelName(bomDetail.name ?? '');
    setDescription(meta.description ?? '');
    setSerial(bomDetail.finishedItem?.serial ?? '');
    setLaborCost(String(bomDetail.standardLaborCost ?? '0'));
    setOverheadCost(String(bomDetail.standardOverheadCost ?? '0'));
    setFromWarehouse(meta.fromWarehouseId ?? '');
    setToWarehouse(meta.toWarehouseId ?? '');
    setCostCenterId(meta.costCenterId ?? meta.costCenter ?? '');
    setStage(meta.stage ?? '');
    setDistributeCostByUnits(Boolean(meta.distributeCostByUnits));
    setStandardExecutionTime(
      meta.standardExecutionTime != null ? String(meta.standardExecutionTime) : ''
    );
    setPricingMethod(
      meta.pricingMethod != null ? parsePricingMethod(meta.pricingMethod) : 'MANUAL'
    );

    const snapshot = meta.rawLinesSnapshot ?? [];
    const dbLines = bomDetail.lines ?? [];
    const rawFromSnapshot =
      snapshot.length > 0 && dbLines.length === 0
        ? snapshot
        : null;
    const lines = (rawFromSnapshot ?? dbLines).map((line, idx) => {
      const snap = snapshot[idx];
      const rawItemId = 'rawItemId' in line ? line.rawItemId : snap?.rawItemId ?? '';
      const item = itemById.get(rawItemId);
      return {
        rawItemId,
        quantity: String(snap?.quantity ?? ('quantity' in line ? line.quantity : 1) ?? '1'),
        unit: unitLabelForItem(item),
        scrapPercentage: '0',
        unitPrice: String(snap?.unitPrice ?? 0),
        lineDescription: snap?.lineDescription ?? ('lineDescription' in line ? line.lineDescription : '') ?? '',
        warehouseId: snap?.warehouseId ?? ('warehouseId' in line ? line.warehouseId : '') ?? '',
        manufacturedItemId:
          snap?.manufacturedItemId ?? ('manufacturedItemId' in line ? line.manufacturedItemId : '') ?? '',
      };
    });
    setRawLines(lines.length > 0 ? lines : emptyRawLines());

    if (meta.outputLines?.length) {
      setOutputLines(
        meta.outputLines.map((o) => ({
          itemId: o.itemId ?? '',
          quantity: String(o.quantity ?? '1'),
          unit: o.unit || unitLabelForItem(itemById.get(o.itemId ?? '')),
          unitPrice: String(o.unitPrice ?? '0'),
          costPercent: String(o.costPercent ?? '0'),
          description: o.description ?? '',
          warehouseId: o.warehouseId ?? '',
        }))
      );
    } else {
      setOutputLines([
        {
          ...emptyOutputLine(),
          itemId: bomDetail.finishedItemId,
          quantity: String(bomDetail.baseQuantity ?? '1'),
        },
      ]);
    }
    if (meta.additionalCosts?.length) {
      setAdditionalCosts(
        meta.additionalCosts.map((c) => ({
          accountId: c.accountId ?? '',
          accountLabel: c.accountLabel ?? '',
          value: String(c.value ?? '0'),
          valuePercent: String(c.valuePercent ?? '0'),
          description: c.description ?? '',
          costCenter: c.costCenter ?? '',
          manufacturedItemId: c.manufacturedItemId ?? '',
        }))
      );
    } else {
      setAdditionalCosts([emptyAdditionalCost()]);
    }
  }

  useEffect(() => {
    if (skipServerHydrateRef.current) {
      skipServerHydrateRef.current = false;
      return;
    }
    if (!bomId || !bomDetail || bomDetail.id !== bomId) return;
    if (hydratedRef.current === bomId) return;
    hydratedRef.current = bomId;
    applyBomDetailToForm(bomDetail);
    unlockForEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unlock once per BOM hydrate
  }, [bomId, bomDetail]);

  useEffect(() => {
    if (!items.length) return;
    setRawLines((prev) =>
      prev.map((line) => {
        if (!line.rawItemId) return line;
        const unit = unitLabelForItem(itemRowForUnit(line.rawItemId));
        return unit !== '—' && unit !== line.unit ? { ...line, unit } : line;
      })
    );
    setOutputLines((prev) =>
      prev.map((line) => {
        if (!line.itemId) return line;
        const unit = unitLabelForItem(itemRowForUnit(line.itemId));
        return unit !== '—' && unit !== line.unit ? { ...line, unit } : line;
      })
    );
  }, [itemRowForUnit, items.length, itemUnitsById]);

  useEffect(() => {
    if (pricingMethod === 'MANUAL') return;
    setRawLines((prev) =>
      prev.map((line) => {
        if (!line.rawItemId.trim()) return line;
        const item = itemById.get(line.rawItemId);
        const nextPrice = unitPriceForItemByMethod(pricingMethod, item);
        if (line.unitPrice === nextPrice) return line;
        return { ...line, unitPrice: nextPrice };
      })
    );
  }, [pricingMethod, itemById]);

  const draftSnapshot = useMemo<MfgBomModelDraft>(
    () => ({
      bomId,
      serial,
      modelName,
      description,
      fromWarehouse,
      toWarehouse,
      costCenterId,
      laborCost,
      overheadCost,
      stage,
      distributeCostByUnits,
      standardExecutionTime,
      pricingMethod,
      rawLines,
      outputLines,
      additionalCosts,
    }),
    [
      bomId,
      serial,
      modelName,
      description,
      fromWarehouse,
      toWarehouse,
      costCenterId,
      laborCost,
      overheadCost,
      stage,
      distributeCostByUnits,
      standardExecutionTime,
      pricingMethod,
      rawLines,
      outputLines,
      additionalCosts,
    ]
  );

  const applyBomModelDraft = useCallback(
    (payload: MfgBomModelDraft) => {
    skipServerHydrateRef.current = true;
    hydratedRef.current = payload.bomId ?? 'draft';
    if (payload.bomId) openBom(payload.bomId);
    else {
      setBomId(null);
      router.replace('/manufacturing/creations/manufacturing-model', { scroll: false });
    }
    setSerial(payload.serial);
    setModelName(payload.modelName);
    setDescription(payload.description);
    setFromWarehouse(payload.fromWarehouse);
    setToWarehouse(payload.toWarehouse);
    setCostCenterId(payload.costCenterId);
    setLaborCost(payload.laborCost);
    setOverheadCost(payload.overheadCost);
    setStage(payload.stage);
    setDistributeCostByUnits(payload.distributeCostByUnits);
    setStandardExecutionTime(payload.standardExecutionTime);
    setPricingMethod(parsePricingMethod(payload.pricingMethod));
    setRawLines(payload.rawLines?.length ? payload.rawLines : emptyRawLines());
    setOutputLines(payload.outputLines?.length ? payload.outputLines : [emptyOutputLine()]);
    setAdditionalCosts(
      payload.additionalCosts?.length ? payload.additionalCosts : [emptyAdditionalCost()]
    );
  },
    [openBom, router]
  );

  const { clearDraft } = useDraftAutosave({
    documentType: 'manufacturing-bom-model',
    mode: bomId ? 'edit' : 'new',
    documentId: bomId,
    value: draftSnapshot,
    enabled: true,
    applyRestore: applyBomModelDraft,
    isEmpty: isMfgBomModelDraftEmpty,
    restoreMessage: 'تم استعادة مسودة نموذج التصنيع',
  });

  const resetToNewBomForm = useCallback(() => {
    skipServerHydrateRef.current = true;
    clearDraft();
    unlockForEdit();
    hydratedRef.current = null;
    setModelName('');
    setDescription('');
    setSerial('');
    setLaborCost('0');
    setOverheadCost('0');
    setRawLines(emptyRawLines());
    setOutputLines([emptyOutputLine()]);
    setAdditionalCosts([emptyAdditionalCost()]);
    setFromWarehouse('');
    setToWarehouse('');
    setCostCenterId('');
    setStage('');
    setDistributeCostByUnits(false);
    setStandardExecutionTime('');
    setPricingMethod('AVERAGE_COST');
    openBom(null);
  }, [clearDraft, unlockForEdit]);

  async function loadBomAsNewDraft(sourceId: string) {
    setError(null);
    setShowPreviousDrawer(false);
    try {
      const res = await apiClient.get<BomDetail>(`/manufacturing/boms/${sourceId}`);
      const detail = res.data;
      hydratedRef.current = 'draft';
      applyBomDetailToForm(detail);
      setSerial('');
      const draftMeta = (detail.formMetadata ?? {}) as BomFormMetadata;
      setModelName(detail.name ? `${detail.name} — مسودة` : '');
      setDescription(draftMeta.description ?? '');
      setBomId(null);
      openBom(null);
      setSuccess('تم تحميل النموذج السابق كمسودة — عدّل ثم احفظ كسجل جديد');
    } catch (err) {
      setError((err as ApiError).message || 'تعذر تحميل النموذج');
    }
  }

  const createBomMutation = useApiMutation<{ id: string; name: string }, Record<string, unknown>>(
    '/manufacturing/boms',
    'POST',
    {
      onSuccess: (res) => {
        const created = (res as unknown as { data: { id: string; name: string } }).data;
        setSuccess('تم حفظ نموذج التصنيع');
        invalidateQuery(['manufacturing-boms']);
        invalidateQuery(['manufacturing-bom', created.id]);
        resetToNewBomForm();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر حفظ النموذج'),
    }
  );

  const labor = Number(laborCost) || 0;
  const overhead = Number(overheadCost) || 0;
  const additionalTotal = additionalCosts.reduce((s, r) => s + (Number(r.value) || 0), 0);

  const filledOutputLines = useMemo(
    () => outputLines.filter((o) => o.itemId.trim()),
    [outputLines]
  );

  const outputItemIdsKey = filledOutputLines.map((o) => o.itemId).join('|');
  useEffect(() => {
    const valid = new Set(filledOutputLines.map((o) => o.itemId));
    setRawLines((prev) =>
      prev.map((l) => ({
        ...l,
        manufacturedItemId: valid.has(l.manufacturedItemId) ? l.manufacturedItemId : '',
      }))
    );
    setAdditionalCosts((prev) =>
      prev.map((c) => ({
        ...c,
        manufacturedItemId: valid.has(c.manufacturedItemId) ? c.manufacturedItemId : '',
      }))
    );
  }, [outputItemIdsKey]);

  const filledRawLinesForCost = useMemo(
    () =>
      rawLines
        .filter((l) => l.rawItemId.trim())
        .map((l) => ({
          quantity: Number(l.quantity) || 0,
          scrapPercentage: Number(l.scrapPercentage) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          manufacturedItemId: l.manufacturedItemId.trim() || undefined,
        })),
    [rawLines]
  );

  const filledAdditionalForCost = useMemo(
    () =>
      additionalCosts
        .filter((c) => c.accountId.trim() || c.accountLabel.trim() || Number(c.value))
        .map((c) => ({
          value: Number(c.value) || 0,
          manufacturedItemId: c.manufacturedItemId.trim() || undefined,
        })),
    [additionalCosts]
  );

  const materialsTotal = useMemo(
    () => computeRawMaterialsTotal(filledRawLinesForCost),
    [filledRawLinesForCost]
  );

  const itemNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) map.set(it.id, it.arabicName);
    return map;
  }, [items]);

  /** Base for additional-cost % ↔ amount (خامات + عمالة + مصاريف من النموذج). */
  const additionalPercentBase = useMemo(
    () => roundMoney(materialsTotal + labor + overhead),
    [materialsTotal, labor, overhead]
  );

  const totalCostPool = useMemo(
    () =>
      computeManufacturingCostPool({
        rawMaterialsTotal: materialsTotal,
        labor,
        overhead,
        additionalTotal,
      }),
    [materialsTotal, labor, overhead, additionalTotal]
  );

  const outputCostDistribution = useMemo(
    () =>
      distributeOutputLineCosts({
        labor,
        overhead,
        outputLines: filledOutputLines.map((o) => ({
          itemId: o.itemId,
          quantity: Number(o.quantity) || 0,
          costPercent: Number(o.costPercent) || 0,
        })),
        rawLines: filledRawLinesForCost,
        additionalLines: filledAdditionalForCost,
        distributeCostByUnits,
      }),
    [
      labor,
      overhead,
      filledOutputLines,
      filledRawLinesForCost,
      filledAdditionalForCost,
      distributeCostByUnits,
    ]
  );

  const outputDistributionByIndex = useMemo(() => {
    const map = new Map<number, (typeof outputCostDistribution)[number]>();
    let filledIdx = 0;
    outputLines.forEach((line, index) => {
      if (!line.itemId.trim()) return;
      map.set(index, outputCostDistribution[filledIdx] ?? {
        lineTotal: 0,
        unitPrice: 0,
        costSharePercent: 0,
        directCost: 0,
        sharedCost: 0,
      });
      filledIdx += 1;
    });
    return map;
  }, [outputLines, outputCostDistribution]);

  const outputPercentSum = useMemo(
    () =>
      sumOutputCostPercents(
        filledOutputLines.map((o) => ({ costPercent: Number(o.costPercent) || 0, quantity: Number(o.quantity) || 0 }))
      ),
    [filledOutputLines]
  );

  const costSlices = useMemo(() => {
    const palette = ['#0d9488', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];
    const slices: { id: string; label: string; value: number; color: string }[] = [
      { id: 'materials', label: 'المواد الخام', value: materialsTotal, color: '#0E78AA' },
    ];
    additionalCosts.forEach((line, index) => {
      const value = Number(line.value) || 0;
      const hasRow =
        value > 0 || line.accountId.trim() || line.accountLabel.trim() || line.description.trim();
      if (!hasRow) return;
      const accountName = line.accountLabel.trim() || line.description.trim() || `تكلفة إضافية ${index + 1}`;
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
  }, [materialsTotal, additionalCosts, itemNameById]);

  const patchAdditionalCostLine = useCallback(
    (
      index: number,
      patch: Partial<AdditionalCostLine>,
      sync: 'value' | 'percent' | null = null
    ) => {
      setAdditionalCosts((prev) => {
        const next = [...prev];
        const row = { ...next[index], ...patch };
        if (sync === 'value') {
          row.valuePercent = additionalPercentFromValue(row.value, additionalPercentBase);
        } else if (sync === 'percent') {
          row.value = additionalValueFromPercent(row.valuePercent, additionalPercentBase);
        }
        next[index] = row;
        return next;
      });
    },
    [additionalPercentBase]
  );

  function buildPayload(): Record<string, unknown> | null {
    const primaryOutput = outputLines.find((o) => o.itemId.trim()) ?? outputLines[0];
    const outItemId = primaryOutput?.itemId.trim();
    if (!modelName.trim()) {
      setError('أدخل اسم النموذج');
      return null;
    }
    if (!outItemId) {
      setError('اختر صنفاً ناتجاً');
      return null;
    }
    const filledRaw = rawLines.filter((l) => l.rawItemId.trim());
    if (filledRaw.length === 0) {
      setError('أضف مادة خام واحدة على الأقل');
      return null;
    }
    for (const line of filledRaw) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError('كمية الخام غير صالحة');
        return null;
      }
    }
    const baseQty = Number(primaryOutput?.quantity);
    if (!Number.isFinite(baseQty) || baseQty <= 0) {
      setError('كمية الصنف الناتج غير صالحة');
      return null;
    }

    const outputsForSave = outputLines.filter((o) => o.itemId.trim());
    if (!distributeCostByUnits) {
      if (outputsForSave.length > 1 && outputPercentSum <= 0) {
        setError('حدد نسب التكلفة للأصناف الناتجة (مثال: 60 و 40)');
        return null;
      }
      if (outputsForSave.length > 1 && Math.abs(outputPercentSum - 100) > 0.01) {
        setError(`مجموع نسب التكلفة = ${outputPercentSum} — يجب أن يساوي 100`);
        return null;
      }
    }

    const distributedForSave = distributeOutputLineCosts({
      labor,
      overhead,
      outputLines: outputsForSave.map((o) => ({
        itemId: o.itemId,
        quantity: Number(o.quantity) || 0,
        costPercent: Number(o.costPercent) || 0,
      })),
      rawLines: filledRaw.map((line) => ({
        quantity: Number(line.quantity) || 0,
        scrapPercentage: Number(line.scrapPercentage) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        manufacturedItemId: line.manufacturedItemId.trim() || undefined,
      })),
      additionalLines: additionalCosts
        .filter((c) => c.accountId.trim() || c.accountLabel.trim() || Number(c.value))
        .map((c) => ({
          value: Number(c.value) || 0,
          manufacturedItemId: c.manufacturedItemId.trim() || undefined,
        })),
      distributeCostByUnits,
    });

    const formMetadata: BomFormMetadata = {
      distributeCostByUnits,
      fromWarehouseId: fromWarehouse || undefined,
      toWarehouseId: toWarehouse || undefined,
      standardExecutionTime: standardExecutionTime ? Number(standardExecutionTime) : undefined,
      stage: stage.trim() || undefined,
      description: description.trim() || undefined,
      costCenterId: costCenterId.trim() || undefined,
      costCenter: costCenterId.trim() || undefined,
      pricingMethod,
      outputLines: outputsForSave.map((o, idx) => ({
          itemId: o.itemId,
          quantity: Number(o.quantity) || 0,
          unit: o.unit,
          unitPrice: distributedForSave[idx]?.unitPrice ?? 0,
          costPercent:
            distributedForSave[idx]?.costSharePercent ??
            (Number(o.costPercent) || 0),
          description: o.description,
          warehouseId: o.warehouseId || undefined,
        })),
      additionalCosts: additionalCosts
        .filter((c) => c.accountId.trim() || c.accountLabel.trim() || Number(c.value))
        .map((c) => ({
          accountId: c.accountId.trim() || undefined,
          accountLabel: c.accountLabel,
          value: Number(c.value) || 0,
          valuePercent: Number(c.valuePercent) || 0,
          description: c.description,
          costCenter: c.costCenter,
          manufacturedItemId: c.manufacturedItemId || undefined,
        })),
      rawLinesSnapshot: filledRaw.map((line) => ({
        rawItemId: line.rawItemId,
        quantity: Number(line.quantity) || 0,
        scrapPercentage: Number(line.scrapPercentage) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        lineDescription: line.lineDescription.trim() || undefined,
        warehouseId: line.warehouseId || undefined,
        manufacturedItemId: line.manufacturedItemId.trim() || undefined,
      })),
    };

    return {
      name: modelName.trim(),
      finishedItemId: outItemId,
      baseQuantity: baseQty,
      standardLaborCost: Number(laborCost) || 0,
      standardOverheadCost: Number(overheadCost) || 0,
      formMetadata,
      lines: filledRaw.map((line, i) => ({
        rawItemId: line.rawItemId,
        quantity: Number(line.quantity),
        scrapPercentage: Number(line.scrapPercentage) || 0,
        lineOrder: i + 1,
        lineDescription: line.lineDescription.trim() || undefined,
        warehouseId: line.warehouseId || undefined,
        manufacturedItemId: line.manufacturedItemId || undefined,
      })),
    };
  }

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    const payload = buildPayload();
    if (!payload) return;

    if (bomId) {
      setSaving(true);
      try {
        await apiClient.put(`/manufacturing/boms/${bomId}`, payload);
        setSuccess('تم تحديث نموذج التصنيع');
        invalidateQuery(['manufacturing-boms']);
        invalidateQuery(['manufacturing-bom', bomId]);
        resetToNewBomForm();
      } catch (err) {
        setError((err as ApiError).message || 'تعذر تحديث النموذج');
      } finally {
        setSaving(false);
      }
      return;
    }
    await createBomMutation.mutateAsync(payload);
  };

  const handleNew = () => {
    resetToNewBomForm();
  };

  const rawUnitPriceReadOnly = pricingMethod !== 'MANUAL';

  const mfgThPct = cn(mfgThClass, 'min-w-[6.5rem] w-[6.5rem] text-center');
  const mfgThDesc = cn(mfgThClass, 'min-w-[8rem]');
  const mfgThWh = cn(mfgThClass, 'min-w-[9rem]');
  const mfgThMfg = cn(mfgThClass, 'min-w-[8rem]');
  const mfgInputQty = cn(compactNumericControlClass, 'max-w-none');
  const mfgInputMoney = mfgInputQty;
  const mfgInputUnit = cn(compactControlClass, 'h-9 min-w-0 px-2.5 text-sm bg-slate-50 text-slate-600');
  const mfgSelectItem = cn(compactControlClass, 'h-10 min-w-[12rem] w-full text-sm');

  const patchLineUnitAfterFetch = useCallback(
    (kind: 'raw' | 'output', index: number, itemId: string) => {
      void ensureItemUnitsLoaded(itemId).then((unit) => {
        if (unit === '—') return;
        if (kind === 'raw') {
          setRawLines((prev) => {
            const row = prev[index];
            if (!row || row.rawItemId !== itemId) return prev;
            if (row.unit === unit) return prev;
            const next = [...prev];
            next[index] = { ...row, unit };
            return next;
          });
        } else {
          setOutputLines((prev) => {
            const row = prev[index];
            if (!row || row.itemId !== itemId) return prev;
            if (row.unit === unit) return prev;
            const next = [...prev];
            next[index] = { ...row, unit };
            return next;
          });
        }
      });
    },
    [ensureItemUnitsLoaded]
  );

  const itemSelect = (
    value: string,
    onChange: (v: string, item?: ItemRow) => void,
    onPicked?: (itemId: string) => void
  ) => (
    <select
      value={value}
      onChange={(e) => {
        const id = e.target.value;
        const item = id ? itemRowForUnit(id) : undefined;
        onChange(id, item);
        if (id) onPicked?.(id);
      }}
      className={mfgSelectItem}
    >
      <option value="">— اختر الصنف —</option>
      {items.map((it) => (
        <option key={it.id} value={it.id}>
          {it.arabicName}
          {it.serial ? ` · ${it.serial}` : ''}
        </option>
      ))}
    </select>
  );

  const warehouseSelect = (value: string, onChange: (v: string) => void, compact = false) => (
    <WarehouseSelect
      value={value}
      onChange={onChange}
      className={compact ? cn(compactControlClass, 'h-8 text-xs') : compactControlClass}
      leafOnly
      emptyLabel="مخزن حركة"
    />
  );

  const manufacturedOutputSelect = (value: string, onChange: (v: string) => void) => {
    if (filledOutputLines.length === 0) {
      return (
        <select disabled className={cn(compactControlClass, 'bg-slate-50 text-slate-400')} title="أضف أصنافاً في جدول الأصناف الناتجة أولاً">
          <option value="">—</option>
        </select>
      );
    }
    const seen = new Set<string>();
    const options = filledOutputLines.filter((o) => {
      if (seen.has(o.itemId)) return false;
      seen.add(o.itemId);
      return true;
    });
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={compactControlClass}
        title="يربط تكلفة هذا السطر بالصنف الناتج المختار فقط"
      >
        <option value="">—</option>
        {options.map((o) => {
          const it = items.find((i) => i.id === o.itemId);
          return (
            <option key={o.itemId} value={o.itemId}>
              {it?.arabicName ?? o.itemId}
              {it?.serial ? ` (${it.serial})` : ''}
            </option>
          );
        })}
      </select>
    );
  };

  if (bomId && bomLoading && !bomDetail) {
    return <PageSkeleton />;
  }

  return (
    <ManufacturingPageChrome
      title="نموذج التصنيع"
      statusLabel={bomId ? 'محفوظ' : 'جديد'}
      docNumber={serial || modelName?.trim() || undefined}
      currentId={bomId}
      favoriteHref="/manufacturing/creations/manufacturing-model"
      onSave={() => void handleSave()}
      savePending={createBomMutation.isPending || saving}
      canSave
      saveLabel={bomId ? 'تحديث النموذج' : 'حفظ النموذج'}
      onBrowseList={() => setShowPreviousDrawer(true)}
      standardActions={{
        hasDocument: Boolean(bomId),
        isPosted: false,
        onNew: handleNew,
        newLabel: 'نموذج جديد',
        onEdit: () => unlockForEdit(),
        onDuplicate: bomId ? () => void loadBomAsNewDraft(bomId) : undefined,
        duplicateLabel: 'نسخ كمسودة',
        hidePostActions: true,
      }}
    >
      <DocumentReadOnlyBanner />
      <DocumentBrowseDrawer
        open={showPreviousDrawer}
        onClose={() => setShowPreviousDrawer(false)}
        title="نماذج التصنيع السابقة"
      >
        <div className="space-y-2">
          {bomList.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">لا توجد نماذج محفوظة</p>
          ) : (
            bomList.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D6EAF3] bg-white px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-[#0A3D5E]">
                    مسلسل الصنف: {b.finishedItem?.serial?.trim() || '—'}
                  </p>
                  <p className="text-slate-700">اسم النموذج: {b.name}</p>
                  <p className="text-xs text-slate-500">
                    {b.finishedItem?.arabicName ? `الصنف: ${b.finishedItem.arabicName}` : ''}
                    {b.baseQuantity != null ? ` · كمية أساسية: ${b.baseQuantity}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setShowPreviousDrawer(false);
                      hydratedRef.current = null;
                      unlockForEdit();
                      openBom(b.id);
                    }}
                  >
                    فتح
                  </Button>
                  <Button type="button" size="sm" onClick={() => void loadBomAsNewDraft(b.id)}>
                    تحميل كمسودة
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DocumentBrowseDrawer>

      <div className="flex justify-start rounded-2xl border border-[#D6EAF3] bg-[#F8FBFD] px-4 py-3 shadow-sm">
        <Switch
          label="توزيع التكلفة حسب الوحدات"
          checked={distributeCostByUnits}
          onCheckedChange={setDistributeCostByUnits}
        />
      </div>

      <FormSectionCard
        title="البيانات الأساسية"
        subtitle="كل الحقول ظاهرة — الأصناف الناتجة والكميات من جدول «أصناف ناتجة»"
        bodyClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      >
        <CompactFormField label="المسلسل" value={serial} onChange={(e) => setSerial(e.target.value)} />
        <CompactFormField
          label="اسم النموذج"
          required
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="مثال: نموذج تصنيع الباب الخشبي"
        />
        <CompactFormField
          label="الشرح"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="ملاحظات أو وصف إضافي"
        />
        <CompactFormField label="من مخزن (حركة)">
          {warehouseSelect(fromWarehouse, setFromWarehouse)}
        </CompactFormField>
        <CompactFormField label="إلى مخزن (حركة)">
          {warehouseSelect(toWarehouse, setToWarehouse)}
        </CompactFormField>
        <CompactFormField label="مركز التكلفة">
          <CostCenterSelect
            value={costCenterId}
            onChange={setCostCenterId}
            className={compactControlClass}
            allowEmpty
            emptyLabel="مركز تكلفة حركة"
            leafOnly
          />
        </CompactFormField>
        <CompactFormField label="العملة" value="جنيه مصري" readOnly />
        <CompactFormField label="طريقة التسعير">
          <select
            value={pricingMethod}
            onChange={(e) => setPricingMethod(parsePricingMethod(e.target.value))}
            className={compactControlClass}
          >
            {ASSEMBLY_PRICING_METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField label="المرحلة" value={stage} onChange={(e) => setStage(e.target.value)} />
        <CompactFormField label="قائمة النماذج المحفوظة">
          <select
            value={bomId ?? ''}
            onChange={(e) => {
              hydratedRef.current = null;
              openBom(e.target.value || null);
            }}
            className={compactControlClass}
          >
            <option value="">— جديد —</option>
            {bomList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField
          label="الزمن المعياري للتنفيذ"
          type="number"
          min={0}
          step="0.01"
          value={standardExecutionTime}
          onChange={(e) => setStandardExecutionTime(e.target.value)}
          placeholder="ساعات — يُنسخ لأمر التصنيع عند التحميل"
        />
      </FormSectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <MfgTableCard
        scrollViewport
        title="أصناف ناتجة"
        toolbar={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setOutputLines((p) => [...p, emptyOutputLine()])}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            إضافة صنف
          </Button>
        }
      >
        <table className={cn(mfgTableClass, 'table-fixed')}>
          <thead className={mfgTheadStickyClass}>
            <tr>
              <th className={mfgThIdx}>م</th>
              <th className={mfgThItem}>إسم الصنف</th>
              <th className={mfgThQty}>الكمية</th>
              <th className={mfgThUnit}>الوحدة</th>
              <th className={mfgThMoney}>سعر</th>
              <th className={mfgThMoney}>إجمالي</th>
              <th className={mfgThPct}>نسبة %</th>
              <th className={mfgThDesc}>البيان</th>
              <th className={mfgThWh}>المخزن</th>
              <th className={cn(mfgThClass, 'w-9')} />
            </tr>
          </thead>
          <tbody>
            {outputLines.map((line, index) => (
              <tr key={index} className={mfgTrClass}>
                <td className={mfgTdIdx}>{index + 1}</td>
                <td className={cn(mfgTdClass, 'min-w-0')}>
                  <div className="flex min-w-0 items-center gap-1">
                    <div className="min-w-0 flex-1">
                      {itemSelect(
                        line.itemId,
                        (v, item) => {
                          const next = [...outputLines];
                          next[index] = {
                            ...next[index],
                            itemId: v,
                            unit: unitLabelForItem(item),
                          };
                          setOutputLines(next);
                        },
                        (itemId) => patchLineUnitAfterFetch('output', index, itemId)
                      )}
                    </div>
                    <ItemAlternativesPeek itemId={line.itemId} />
                  </div>
                </td>
                <td className={mfgTdClass}>
                  <input
                    type="number"
                    className={mfgInputQty}
                    value={line.quantity}
                    onChange={(e) => {
                      const next = [...outputLines];
                      next[index] = { ...next[index], quantity: e.target.value };
                      setOutputLines(next);
                    }}
                  />
                </td>
                <td className={mfgTdClass}>
                  <span className={cn(mfgInputUnit, 'inline-flex items-center')}>
                    {line.unit || unitLabelForItem(itemRowForUnit(line.itemId))}
                  </span>
                </td>
                <td className={mfgTdClass}>
                  <input
                    type="number"
                    readOnly
                    title="يُحسب تلقائياً من إجمالي التكلفة ÷ الكمية حسب نسبة التكلفة"
                    className={cn(mfgInputMoney, 'bg-slate-50')}
                    value={
                      line.itemId.trim()
                        ? String(outputDistributionByIndex.get(index)?.unitPrice ?? 0)
                        : line.unitPrice
                    }
                  />
                </td>
                <td className={mfgTdNum}>
                  {(line.itemId.trim()
                    ? outputDistributionByIndex.get(index)?.lineTotal ?? 0
                    : lineTotal(line.quantity, line.unitPrice)
                  ).toLocaleString('ar-EG')}
                </td>
                <td className={mfgTdClass}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    readOnly={distributeCostByUnits}
                    title={
                      distributeCostByUnits
                        ? 'تُحسب تلقائياً من كمية الإنتاج ÷ إجمالي الكميات'
                        : undefined
                    }
                    className={cn(mfgInputQty, distributeCostByUnits && 'bg-slate-50')}
                    value={
                      line.itemId.trim() && distributeCostByUnits
                        ? String(outputDistributionByIndex.get(index)?.costSharePercent ?? 0)
                        : line.costPercent
                    }
                    onChange={(e) => {
                      if (distributeCostByUnits) return;
                      const next = [...outputLines];
                      next[index] = { ...next[index], costPercent: e.target.value };
                      setOutputLines(next);
                    }}
                  />
                </td>
                <td className={mfgTdClass}>
                  <input
                    className={cn(compactControlClass, 'h-8 min-w-0 px-1.5 text-xs')}
                    value={line.description}
                    onChange={(e) => {
                      const next = [...outputLines];
                      next[index] = { ...next[index], description: e.target.value };
                      setOutputLines(next);
                    }}
                  />
                </td>
                <td className={mfgTdClass}>
                  {warehouseSelect(
                    line.warehouseId,
                    (v) => {
                    const next = [...outputLines];
                    next[index] = { ...next[index], warehouseId: v };
                    setOutputLines(next);
                  },
                    true
                  )}
                </td>
                <td className={mfgTdClass}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={outputLines.length <= 1}
                    onClick={() => setOutputLines((p) => p.filter((_, i) => i !== index))}
                    className="h-8 w-8 p-0 text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-600 tabular-nums">
          إجمالي تكلفة النموذج (خام + عمالة + مصاريف + إضافية):{' '}
          <span className="font-semibold text-[#0E78AA]">{totalCostPool.toLocaleString('ar-EG')}</span>
          {distributeCostByUnits && filledOutputLines.length > 0 ? (
            <>
              {' '}
              — التوزيع حسب الوحدات على{' '}
              <span className="font-semibold">
                {(materialsTotal + additionalTotal).toLocaleString('ar-EG')}
              </span>{' '}
              (خامات + تكاليف إضافية) حسب كميات الأصناف الناتجة
            </>
          ) : null}
          {!distributeCostByUnits && filledOutputLines.length > 1 ? (
            <>
              {' '}
              — مجموع نسب التكلفة:{' '}
              <span
                className={cn(
                  'font-semibold',
                  Math.abs(outputPercentSum - 100) > 0.01 ? 'text-amber-700' : 'text-emerald-700'
                )}
              >
                {outputPercentSum.toLocaleString('ar-EG')}%
              </span>
              {Math.abs(outputPercentSum - 100) > 0.01 ? ' (المطلوب 100%)' : null}
            </>
          ) : null}
        </p>
      </MfgTableCard>

      <MfgTableCard
        scrollViewport
        title="أصناف الخامات الأولية"
        toolbar={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setRawLines((p) => [...p, emptyRawLines()[0]])}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            إضافة خام
          </Button>
        }
      >
        <table className={cn(mfgTableClass, 'table-fixed')}>
          <thead className={mfgTheadStickyClass}>
            <tr>
              <th className={mfgThIdx}>م</th>
              <th className={mfgThItem}>إسم الصنف</th>
              <th className={mfgThQty}>الكمية</th>
              <th className={mfgThUnit}>الوحدة</th>
              <th className={mfgThMoney}>سعر</th>
              <th className={mfgThMoney}>إجمالي</th>
              <th className={mfgThDesc}>البيان</th>
              <th className={mfgThWh}>المخزن</th>
              <th className={mfgThMfg}>مادة مصنعة</th>
              <th className={cn(mfgThClass, 'w-9')} />
            </tr>
          </thead>
          <tbody>
            {rawLines.map((line, index) => (
              <tr key={index} className={mfgTrClass}>
                <td className={mfgTdIdx}>{index + 1}</td>
                <td className={cn(mfgTdClass, 'min-w-0')}>
                  <div className="flex min-w-0 items-center gap-1">
                    <div className="min-w-0 flex-1">
                      {itemSelect(
                        line.rawItemId,
                        (v, item) => {
                          const next = [...rawLines];
                          const prev = next[index];
                          const unitPrice =
                            pricingMethod === 'MANUAL'
                              ? !prev.unitPrice || Number(prev.unitPrice) === 0
                                ? '0'
                                : prev.unitPrice
                              : unitPriceForItemByMethod(pricingMethod, item);
                          next[index] = {
                            ...prev,
                            rawItemId: v,
                            unit: unitLabelForItem(item),
                            unitPrice,
                          };
                          setRawLines(next);
                        },
                        (itemId) => patchLineUnitAfterFetch('raw', index, itemId)
                      )}
                    </div>
                    <ItemAlternativesPeek itemId={line.rawItemId} />
                  </div>
                </td>
                <td className={mfgTdClass}>
                  <input
                    type="number"
                    className={mfgInputQty}
                    value={line.quantity}
                    onChange={(e) => {
                      const next = [...rawLines];
                      next[index] = { ...next[index], quantity: e.target.value };
                      setRawLines(next);
                    }}
                  />
                </td>
                <td className={mfgTdClass}>
                  <span className={cn(mfgInputUnit, 'inline-flex items-center')}>
                    {line.unit || unitLabelForItem(itemRowForUnit(line.rawItemId))}
                  </span>
                </td>
                <td className={mfgTdClass}>
                  <input
                    type="number"
                    className={cn(mfgInputMoney, rawUnitPriceReadOnly && 'bg-slate-50 text-slate-600')}
                    value={line.unitPrice}
                    readOnly={rawUnitPriceReadOnly}
                    onChange={(e) => {
                      if (rawUnitPriceReadOnly) return;
                      const next = [...rawLines];
                      next[index] = { ...next[index], unitPrice: e.target.value };
                      setRawLines(next);
                    }}
                  />
                </td>
                <td className={mfgTdNum}>
                  {lineTotal(line.quantity, line.unitPrice).toLocaleString('ar-EG')}
                </td>
                <td className={mfgTdClass}>
                  <input
                    className={cn(compactControlClass, 'h-9 min-w-0 px-2.5 text-sm')}
                    value={line.lineDescription}
                    onChange={(e) => {
                      const next = [...rawLines];
                      next[index] = { ...next[index], lineDescription: e.target.value };
                      setRawLines(next);
                    }}
                  />
                </td>
                <td className={mfgTdClass}>
                  {warehouseSelect(
                    line.warehouseId,
                    (v) => {
                    const next = [...rawLines];
                    next[index] = { ...next[index], warehouseId: v };
                    setRawLines(next);
                  },
                    true
                  )}
                </td>
                <td className={mfgTdClass}>
                  {manufacturedOutputSelect(line.manufacturedItemId, (v) => {
                    const next = [...rawLines];
                    next[index] = { ...next[index], manufacturedItemId: v };
                    setRawLines(next);
                  })}
                </td>
                <td className={mfgTdClass}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={rawLines.length <= 1}
                    onClick={() => setRawLines((p) => p.filter((_, i) => i !== index))}
                    className="h-8 w-8 p-0 text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500 tabular-nums">
          إجمالي كميات الخام:{' '}
          {rawLines
            .reduce((s, l) => s + (Number(l.quantity) || 0), 0)
            .toLocaleString('ar-EG', { maximumFractionDigits: 4 })}
        </p>
      </MfgTableCard>
      </div>

      <MfgTableCard
        scrollViewport
        title="تكلفة إضافية"
        toolbar={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAdditionalCosts((p) => [...p, emptyAdditionalCost()])}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            إضافة تكلفة
          </Button>
        }
      >
        <p className="mb-2 text-xs text-slate-600">
          القيمة والنسبة مرتبطتان: النسبة من إجمالي{' '}
          <span className="font-semibold tabular-nums text-[#0A3D5E]">
            {additionalPercentBase.toLocaleString('ar-EG')}
          </span>{' '}
          جنيه (خامات + عمالة + مصاريف محفوظة في النموذج). مثال: 10٪ ={' '}
          {additionalValueFromPercent('10', additionalPercentBase)} جنيه.
        </p>
        <div className="overflow-x-auto">
          <table className={cn(mfgTableClass, 'min-w-[920px]')}>
            <thead className={mfgTheadStickyClass}>
              <tr>
                <th className={mfgThIdx}>م</th>
                <th className={cn(mfgThClass, 'min-w-[220px]')}>الحساب</th>
                <th className={cn(mfgThClass, 'min-w-[180px]')}>مركز التكلفة</th>
                <th className={mfgThMoney}>القيمة (ج.م)</th>
                <th className={mfgThPct}>النسبة %</th>
                <th className={cn(mfgThClass, 'min-w-[160px]')}>الصنف الناتج</th>
                <th className={cn(mfgThClass, 'min-w-[140px]')}>الشرح</th>
                <th className={cn(mfgThClass, 'w-10')} />
              </tr>
            </thead>
            <tbody>
              {additionalCosts.map((line, index) => (
                <tr key={index} className={mfgTrClass}>
                  <td className={mfgTdIdx}>{index + 1}</td>
                  <td className={mfgTdClass}>
                    <div className="min-w-[200px]">
                      <AccountSelect
                        value={line.accountId}
                        onChange={(accountId) => patchAdditionalCostLine(index, { accountId })}
                        className={cn(compactControlClass, 'w-full min-w-[200px]')}
                        placeholder="اختر الحساب"
                        selectedAccount={
                          line.accountId && line.accountLabel
                            ? {
                                id: line.accountId,
                                code: '',
                                arabicName: line.accountLabel,
                              }
                            : undefined
                        }
                      />
                    </div>
                  </td>
                  <td className={mfgTdClass}>
                    <div className="min-w-[160px]">
                      <CostCenterSelect
                        value={line.costCenter}
                        onChange={(id) => patchAdditionalCostLine(index, { costCenter: id })}
                        className={cn(compactControlClass, 'w-full min-w-[160px]')}
                        allowEmpty
                        emptyLabel="مركز تكلفة"
                        leafOnly
                      />
                    </div>
                  </td>
                  <td className={mfgTdClass}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={cn(compactNumericControlClass, 'max-w-none')}
                      value={line.value}
                      onChange={(e) => patchAdditionalCostLine(index, { value: e.target.value }, 'value')}
                    />
                  </td>
                  <td className={mfgTdClass}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={cn(compactNumericControlClass, 'max-w-none')}
                      value={line.valuePercent}
                      onChange={(e) =>
                        patchAdditionalCostLine(index, { valuePercent: e.target.value }, 'percent')
                      }
                    />
                  </td>
                  <td className={mfgTdClass}>
                    {manufacturedOutputSelect(line.manufacturedItemId, (v) =>
                      patchAdditionalCostLine(index, { manufacturedItemId: v })
                    )}
                  </td>
                  <td className={mfgTdClass}>
                    <input
                      className={compactControlClass}
                      value={line.description}
                      onChange={(e) => patchAdditionalCostLine(index, { description: e.target.value })}
                    />
                  </td>
                  <td className={mfgTdClass}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={additionalCosts.length <= 1}
                      onClick={() => setAdditionalCosts((p) => p.filter((_, i) => i !== index))}
                      className="h-8 w-8 p-0 text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm font-bold tabular-nums text-[#0E78AA]">
          إجمالي التكاليف الإضافية: {additionalTotal.toLocaleString('ar-EG')} جنيه
        </p>
      </MfgTableCard>

      <CostRollupCard title="تحليل التكلفة القياسية" slices={costSlices} className="mb-4" />

      {error && <ErrorToast message={error} onClose={() => setError(null)} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess(null)} />}
    </ManufacturingPageChrome>
  );
}
