'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
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
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import {
  ManufacturingPageChrome,
  MfgEmptyRow,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgThClass,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';
import { ManufacturingQuantityCheckDialog } from '@/components/manufacturing/ManufacturingQuantityCheckDialog';
import {
  buildLoadedProcessFromBom,
  type BomForProcess,
  type LoadedManufacturingProcess,
} from '@/lib/manufacturing/process-from-bom';
import { stashMfgOperationPrefill } from '@/lib/manufacturing/mfg-operation-prefill';
import { stashMfgTransferPrefill } from '@/lib/manufacturing/mfg-transfer-prefill';
import { buildShortageTransferLines, shortageTransferError } from '@/lib/manufacturing/mfg-transfer-shortage';
import { cn } from '@/lib/utils';
import type { ApiError } from '@/lib/api/types';

type PlanLine = {
  id: string;
  lineNo: number;
  date: string;
  bomId: string;
  stage: string;
  quantity: string;
  warehouseId: string;
  costCenter: string;
};

type BomListItem = { id: string; name: string; finishedItem?: { arabicName?: string } };

type SavedPlanLine = {
  id: string;
  lineNo: number;
  lineDate: string;
  bomId: string;
  stage: string | null;
  quantity: string | number;
  warehouseId: string | null;
  costCenter: string | null;
};

type SavedPlan = {
  id: string;
  planNumber: string;
  description: string | null;
  headerBomId: string | null;
  headerStage: string | null;
  fromWarehouseId: string | null;
  costCenter: string | null;
  lines: SavedPlanLine[];
};

type PlanListItem = {
  id: string;
  planNumber: string;
  description: string | null;
  updatedAt: string;
  _count?: { lines: number };
};

function newLineId() {
  return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyLine(lineNo: number, defaults: Partial<PlanLine>): PlanLine {
  return {
    id: newLineId(),
    lineNo,
    date: defaults.date ?? new Date().toISOString().slice(0, 10),
    bomId: defaults.bomId ?? '',
    stage: defaults.stage ?? '',
    quantity: defaults.quantity ?? '1',
    warehouseId: defaults.warehouseId ?? '',
    costCenter: defaults.costCenter ?? '',
  };
}

export default function ManufacturingPlanPage() {
  useBackendReachability();
  const router = useRouter();
  const invalidateQuery = useInvalidateQuery();
  const today = new Date().toISOString().slice(0, 10);

  const [planId, setPlanId] = useState<string | null>(null);
  const [planSerial, setPlanSerial] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [headerBomId, setHeaderBomId] = useState('');
  const [headerStage, setHeaderStage] = useState('');
  const [headerFromWarehouse, setHeaderFromWarehouse] = useState('');
  const [headerCostCenter, setHeaderCostCenter] = useState('');

  const [lines, setLines] = useState<PlanLine[]>([emptyLine(1, { date: today })]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [checkProcess, setCheckProcess] = useState<LoadedManufacturingProcess | null>(null);
  const [showQtyCheck, setShowQtyCheck] = useState(false);
  const [showTransferPick, setShowTransferPick] = useState(false);
  const [checkWarehouseId, setCheckWarehouseId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPreviousDrawer, setShowPreviousDrawer] = useState(false);

  const { data: bomsResponse } = useApiQuery<BomListItem[]>(['manufacturing-boms'], '/manufacturing/boms');
  const { data: plansListResponse } = useApiQuery<PlanListItem[]>(
    ['manufacturing-plans'],
    '/manufacturing/plans',
    { enabled: showPreviousDrawer }
  );
  const planList = plansListResponse?.data ?? [];
  const boms = bomsResponse?.data ?? [];
  const bomNameById = useMemo(() => new Map(boms.map((b) => [b.id, b.name])), [boms]);

  const selectedLine = lines.find((l) => l.id === selectedLineId) ?? null;

  const savePlanMutation = useApiMutation<{ data: SavedPlan }, Record<string, unknown>>(
    planId ? `/manufacturing/plans/${planId}` : '/manufacturing/plans',
    planId ? 'PUT' : 'POST',
    {
      onSuccess: (res) => {
        const saved = (res as unknown as { data: SavedPlan }).data;
        applyPlanToForm(saved, 'open');
        setSuccess(planId ? 'تم تحديث خطة التصنيع' : 'تم حفظ خطة التصنيع');
        invalidateQuery(['manufacturing-plans']);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر حفظ الخطة'),
    }
  );

  function applyPlanToForm(source: SavedPlan, mode: 'open' | 'copy') {
    if (mode === 'open') {
      setPlanId(source.id);
      setPlanSerial(source.planNumber);
    } else {
      setPlanId(null);
      setPlanSerial('');
      setSuccess('تم تحميل الخطة كمسودة — عدّل واحفظ كخطة جديدة');
    }
    setPlanDescription(source.description ?? '');
    setHeaderBomId(source.headerBomId ?? '');
    setHeaderStage(source.headerStage ?? '');
    setHeaderFromWarehouse(source.fromWarehouseId ?? '');
    setHeaderCostCenter(source.costCenter ?? '');
    const mapped = source.lines.map((l) => ({
      id: mode === 'open' ? l.id : newLineId(),
      lineNo: l.lineNo,
      date: l.lineDate.slice(0, 10),
      bomId: l.bomId,
      stage: l.stage ?? '',
      quantity: String(l.quantity),
      warehouseId: l.warehouseId ?? '',
      costCenter: l.costCenter ?? '',
    }));
    setLines(mapped.length ? mapped : [emptyLine(1, { date: today })]);
    setSelectedLineId(mapped[0]?.id ?? null);
  }

  function buildPlanPayload() {
    return {
      planNumber: planSerial.trim() || `MP-${Date.now()}`,
      description: planDescription.trim() || undefined,
      headerBomId: headerBomId || undefined,
      headerStage: headerStage.trim() || undefined,
      fromWarehouseId: headerFromWarehouse || undefined,
      costCenter: headerCostCenter.trim() || undefined,
      lines: lines.map((l, index) => ({
        lineNo: index + 1,
        lineDate: l.date || today,
        bomId: l.bomId,
        stage: l.stage.trim() || undefined,
        quantity: Number(l.quantity),
        warehouseId: l.warehouseId || undefined,
        costCenter: l.costCenter.trim() || undefined,
      })),
    };
  }

  async function handleSavePlan() {
    setError(null);
    setSuccess(null);
    if (lines.some((l) => !l.bomId)) {
      setError('كل سطر في الخطة يحتاج نموذج تصنيع');
      return;
    }
    if (lines.some((l) => !Number.isFinite(Number(l.quantity)) || Number(l.quantity) <= 0)) {
      setError('تحقق من كميات أسطر الخطة');
      return;
    }
    await savePlanMutation.mutateAsync(buildPlanPayload());
  }

  async function openPreviousPlan(id: string) {
    setShowPreviousDrawer(false);
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.get<SavedPlan>(`/manufacturing/plans/${id}`);
      applyPlanToForm(res.data, 'open');
      setSuccess(null);
    } catch (err) {
      setError((err as ApiError).message || 'تعذر فتح الخطة');
    } finally {
      setBusy(false);
    }
  }

  async function loadPlanAsNewDraft(id: string) {
    setShowPreviousDrawer(false);
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.get<SavedPlan>(`/manufacturing/plans/${id}`);
      applyPlanToForm(res.data, 'copy');
    } catch (err) {
      setError((err as ApiError).message || 'تعذر تحميل الخطة');
    } finally {
      setBusy(false);
    }
  }

  function handleNewPlan() {
    setPlanId(null);
    setPlanSerial('');
    setPlanDescription('');
    setHeaderBomId('');
    setHeaderStage('');
    setHeaderFromWarehouse('');
    setHeaderCostCenter('');
    setLines([emptyLine(1, { date: today })]);
    setSelectedLineId(null);
    setError(null);
    setSuccess(null);
  }

  const addLineFromHeader = () => {
    setLines((prev) => [
      ...prev,
      emptyLine(prev.length + 1, {
        date: today,
        bomId: headerBomId,
        stage: headerStage,
        quantity: '1',
        warehouseId: headerFromWarehouse,
        costCenter: headerCostCenter,
      }),
    ]);
  };

  const loadBomForLine = useCallback(async (line: PlanLine): Promise<LoadedManufacturingProcess | null> => {
    if (!line.bomId) return null;
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    const res = await apiClient.get<BomForProcess & { lines?: unknown[] }>(`/manufacturing/boms/${line.bomId}`);
    const bom = res.data;
    let loaded = buildLoadedProcessFromBom(bom, qty);
    if (!loaded) return null;
    if (line.stage) loaded = { ...loaded, stage: line.stage };
    if (line.warehouseId) {
      loaded = {
        ...loaded,
        fromWarehouseId: headerFromWarehouse || loaded.fromWarehouseId,
        toWarehouseId: line.warehouseId,
      };
    }
    if (line.costCenter) loaded = { ...loaded, costCenter: line.costCenter };
    if (headerFromWarehouse) {
      loaded = { ...loaded, fromWarehouseId: headerFromWarehouse };
    }
    return loaded;
  }, [headerFromWarehouse]);

  async function requireSelectedLine(): Promise<PlanLine | null> {
    setError(null);
    if (!selectedLine) {
      setError('اختر سطراً من جدول تفاصيل الخطة');
      return null;
    }
    if (!selectedLine.bomId) {
      setError('حدد النموذج في السطر المختار');
      return null;
    }
    return selectedLine;
  }

  async function handleCheckQuantities() {
    const line = await requireSelectedLine();
    if (!line) return;
    setBusy(true);
    try {
      const loaded = await loadBomForLine(line);
      if (!loaded?.raws.length) {
        setError('لا توجد خامات — تأكد من النموذج وعدد الكمية');
        return;
      }
      setCheckProcess(loaded);
      setCheckWarehouseId(headerFromWarehouse || loaded.fromWarehouseId || line.warehouseId);
      setShowQtyCheck(true);
    } catch (err) {
      setError((err as ApiError).message || 'تعذر فحص الكميات');
    } finally {
      setBusy(false);
    }
  }

  async function handleManufacture() {
    const line = await requireSelectedLine();
    if (!line) return;
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('كمية السطر غير صالحة');
      return;
    }
    stashMfgOperationPrefill({
      bomId: line.bomId,
      stage: line.stage || headerStage,
      fromWarehouseId: headerFromWarehouse,
      toWarehouseId: line.warehouseId,
      costCenter: line.costCenter || headerCostCenter,
      numberOfModels: qty,
      description: planDescription || `من خطة ${planSerial || '—'} — سطر ${line.lineNo}`,
      autoLoad: true,
    });
    router.push('/manufacturing/operations/operation');
  }

  async function openTransfer(kind: 'raw' | 'finished', quantityMode: 'full' | 'shortage' = 'full') {
    const line = await requireSelectedLine();
    if (!line) return;
    setBusy(true);
    try {
      const loaded = await loadBomForLine(line);
      if (!loaded) {
        setError('تعذر تحميل بيانات النموذج');
        return;
      }
      const fromWh = headerFromWarehouse || loaded.fromWarehouseId;
      const toWh = line.warehouseId || loaded.toWarehouseId;
      if (!fromWh || !toWh) {
        setError('حدد «من مخزن» في الرأس ومخزن التصنيع في السطر');
        return;
      }
      if (fromWh === toWh) {
        setError('مخزن المصدر والوجهة متطابقان — اختر مخزنين مختلفين');
        return;
      }

      let transferLines: Array<{ itemId: string; quantity: number; itemName?: string }> = [];
      if (kind === 'raw') {
        const rawRows = loaded.raws.map((r) => ({
          itemId: r.itemId,
          quantity: r.quantity,
          itemName: r.itemName,
          warehouseId: r.warehouseId || fromWh,
        }));
        if (quantityMode === 'shortage') {
          transferLines = await buildShortageTransferLines(rawRows, fromWh);
          if (transferLines.length === 0) {
            setError('لا يوجد عجز في مخزن المصدر لهذا السطر');
            return;
          }
        } else {
          transferLines = rawRows.map((r) => ({
            itemId: r.itemId,
            quantity: r.quantity,
            itemName: r.itemName,
          }));
        }
      } else {
        transferLines = loaded.outputs.map((o) => ({
          itemId: o.itemId,
          quantity: o.quantity,
          itemName: o.itemName,
        }));
      }

      if (transferLines.length === 0) {
        setError(kind === 'raw' ? 'لا خامات للنقل' : 'لا أصناف ناتجة للنقل');
        return;
      }
      stashMfgTransferPrefill({
        description:
          quantityMode === 'shortage'
            ? `نقل عجز خامات — خطة سطر ${line.lineNo}`
            : `نقل من خطة تصنيع — سطر ${line.lineNo}`,
        fromWarehouseId: fromWh,
        toWarehouseId: toWh,
        lines: transferLines,
        returnHref: '/manufacturing/creations/manufacturing-plan',
        returnLabel: 'خطة التصنيع',
        shortageOnly: quantityMode === 'shortage',
      });
      setShowTransferPick(false);
      setShowQtyCheck(false);
      router.push('/inventory/operations/transfer');
    } catch (err) {
      setError(shortageTransferError(err) || (err as ApiError).message || 'تعذر فتح النقل المخزني');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ManufacturingPageChrome
      title="خطة التصنيع"
      statusLabel={planId ? 'محفوظة' : 'جديدة'}
      docNumber={planSerial || undefined}
      currentId={planId}
      favoriteHref="/manufacturing/creations/manufacturing-plan"
      onSave={() => void handleSavePlan()}
      savePending={savePlanMutation.isPending || busy}
      saveLabel={planId ? 'تحديث الخطة' : 'حفظ الخطة'}
      onBrowseList={() => setShowPreviousDrawer(true)}
      extraActions={
        <Button type="button" variant="secondary" size="sm" onClick={handleNewPlan}>
          جديد
        </Button>
      }
    >
      <DocumentBrowseDrawer open={showPreviousDrawer} onClose={() => setShowPreviousDrawer(false)} title="خطط التصنيع السابقة">
        <div className="space-y-2">
          {planList.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">لا توجد خطط محفوظة</p>
          ) : (
            planList.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D6EAF3] bg-white px-3 py-2"
              >
                <div>
                  <span className="text-sm font-medium text-[#0A3D5E]">{p.planNumber}</span>
                  {p.description ? <p className="text-xs text-slate-500">{p.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => void openPreviousPlan(p.id)}>
                    فتح
                  </Button>
                  <Button type="button" size="sm" onClick={() => void loadPlanAsNewDraft(p.id)}>
                    تحميل كمسودة
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DocumentBrowseDrawer>

      <FormSectionCard title="بيانات الخطة" subtitle="المسلسل والشرح والنموذج والمرحلة والمخزن" bodyClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <CompactFormField label="المسلسل" value={planSerial} onChange={(e) => setPlanSerial(e.target.value)} />
        <CompactFormField label="الشرح" value={planDescription} onChange={(e) => setPlanDescription(e.target.value)} />
        <CompactFormField label="نموذج (افتراضي للسطر الجديد)">
          <select className={compactControlClass} value={headerBomId} onChange={(e) => setHeaderBomId(e.target.value)}>
            <option value="">—</option>
            {boms.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.finishedItem?.arabicName ? ` — ${b.finishedItem.arabicName}` : ''}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField label="المرحلة" value={headerStage} onChange={(e) => setHeaderStage(e.target.value)} />
        <CompactFormField label="من مخزن">
          <WarehouseSelect value={headerFromWarehouse} onChange={setHeaderFromWarehouse} className={compactControlClass} emptyLabel="مصدر الخامات" />
        </CompactFormField>
        <CompactFormField label="مركز التكلفة" value={headerCostCenter} onChange={(e) => setHeaderCostCenter(e.target.value)} />
      </FormSectionCard>

      <MfgTableCard
        title="تفاصيل خطة التصنيع"
        toolbar={
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={addLineFromHeader}>
            <Plus className="h-4 w-4" />
            إضافة سطر
          </Button>
        }
      >
        <table className={mfgTableClass}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={mfgThClass}>الرقم</th>
              <th className={mfgThClass}>التاريخ</th>
              <th className={mfgThClass}>النموذج</th>
              <th className={mfgThClass}>المرحلة</th>
              <th className={mfgThClass}>الكمية</th>
              <th className={mfgThClass}>مخزن التصنيع</th>
              <th className={mfgThClass}>مركز التكلفة</th>
              <th className={cn(mfgThClass, 'w-10')} />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr
                key={line.id}
                className={cn(mfgTrClass, 'cursor-pointer', selectedLineId === line.id && 'bg-[#E8F4FA]')}
                onClick={() => setSelectedLineId(line.id)}
              >
                <td className={mfgTdClass}>{line.lineNo}</td>
                <td className={mfgTdClass}>
                  <input
                    type="date"
                    className={compactControlClass}
                    value={line.date}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((p) => p.map((l) => (l.id === line.id ? { ...l, date: v } : l)));
                    }}
                  />
                </td>
                <td className={mfgTdClass}>
                  <select
                    className={compactControlClass}
                    value={line.bomId}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((p) => p.map((l) => (l.id === line.id ? { ...l, bomId: v } : l)));
                    }}
                  >
                    <option value="">—</option>
                    {boms.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={mfgTdClass}>
                  <input
                    className={compactControlClass}
                    value={line.stage}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((p) => p.map((l) => (l.id === line.id ? { ...l, stage: v } : l)));
                    }}
                  />
                </td>
                <td className={mfgTdClass}>
                  <input
                    type="number"
                    min={0}
                    step="0.0001"
                    className={compactControlClass}
                    value={line.quantity}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((p) => p.map((l) => (l.id === line.id ? { ...l, quantity: v } : l)));
                    }}
                  />
                </td>
                <td className={mfgTdClass} onClick={(e) => e.stopPropagation()}>
                  <WarehouseSelect
                    value={line.warehouseId}
                    onChange={(v) => setLines((p) => p.map((l) => (l.id === line.id ? { ...l, warehouseId: v } : l)))}
                    className={compactControlClass}
                    emptyLabel="مخزن التصنيع"
                  />
                </td>
                <td className={mfgTdClass}>
                  <input
                    className={compactControlClass}
                    value={line.costCenter}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((p) => p.map((l) => (l.id === line.id ? { ...l, costCenter: v } : l)));
                    }}
                  />
                </td>
                <td className={mfgTdClass} onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={lines.length <= 1}
                    className="h-8 w-8 p-0 text-rose-600"
                    onClick={() => {
                      setLines((p) => {
                        const next = p.filter((l) => l.id !== line.id).map((l, i) => ({ ...l, lineNo: i + 1 }));
                        if (selectedLineId === line.id) setSelectedLineId(next[0]?.id ?? null);
                        return next;
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {lines.length === 0 ? <MfgEmptyRow colSpan={8}>أضف سطراً للخطة</MfgEmptyRow> : null}
          </tbody>
        </table>
        {selectedLine ? (
          <p className="border-t border-[#EEF5F9] px-4 py-2 text-xs text-slate-600">
            السطر المختار: {selectedLine.lineNo} — {bomNameById.get(selectedLine.bomId) ?? 'بدون نموذج'}
          </p>
        ) : (
          <p className="border-t border-[#EEF5F9] px-4 py-2 text-xs text-amber-700">اضغط على سطر في الجدول ثم استخدم الأزرار أدناه</p>
        )}
      </MfgTableCard>

      <div className="flex flex-wrap gap-3">
        <Button type="button" className="bg-[#0E78AA] hover:bg-[#0B6188]" disabled={busy} onClick={() => void handleManufacture()}>
          تصنيع
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleCheckQuantities()}>
          فحص الكميات
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void requireSelectedLine().then((l) => l && setShowTransferPick(true))}>
          نقل مخزني
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{success}</p>
      ) : null}

      <ManufacturingQuantityCheckDialog
        open={showQtyCheck}
        onClose={() => setShowQtyCheck(false)}
        rows={checkProcess?.raws ?? []}
        defaultWarehouseId={checkWarehouseId}
        onTransferShortages={checkProcess ? () => void openTransfer('raw', 'shortage') : undefined}
        transferShortagesPending={busy}
      />

      {showTransferPick ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-[#0A3D5E]">نقل مخزني من الخطة</h3>
            <p className="mt-2 text-sm text-slate-600">نقل كميات السطر المختار (خامات أو منتجات ناتجة).</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" disabled={busy} onClick={() => void openTransfer('raw', 'shortage')}>
                مواد خام — العجز فقط
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
