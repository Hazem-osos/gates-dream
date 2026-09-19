'use client';

import { useMemo, useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  compactControlClass,
  WorkflowStepper,
  CostRollupCard,
  Button,
  Switch,
} from '@/components/ui';
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
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface BomLine {
  id: string;
  rawItemId: string;
  quantity: string | number;
  scrapPercentage: string | number;
  lineOrder: number;
  rawItem?: { id: string; arabicName: string; serial: string | null };
}

interface Bom {
  id: string;
  name: string;
  baseQuantity: string | number;
  standardLaborCost: string | number;
  standardOverheadCost: string | number;
  finishedItem?: { id: string; arabicName: string; serial?: string | null };
  lines?: BomLine[];
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  status: 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  plannedQuantity: string | number;
  actualQuantity: string | number | null;
  totalMaterialCost: string | number;
  totalLaborCost: string | number;
  totalOverheadCost: string | number;
  unitCost: string | number;
  materialsIssueJournalEntryId: string | null;
  completionJournalEntryId: string | null;
}

interface Warehouse {
  id: string;
  arabicName?: string;
  name?: string;
  code?: string;
}

const POSTED_STATUSES = ['IN_PROGRESS', 'COMPLETED'];

const WORKFLOW_STEPS = [
  { id: 'draft', label: 'مسودة' },
  { id: 'in_progress', label: 'قيد التنفيذ' },
  { id: 'qc', label: 'مراقبة الجودة' },
  { id: 'finished', label: 'منتهي' },
  { id: 'closed', label: 'مغلق' },
];

function num(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function fmt(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function fmtPct(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function statusToStepIndex(status: ProductionOrder['status'] | undefined): number {
  if (!status || status === 'DRAFT' || status === 'CANCELLED') return 0;
  if (status === 'RELEASED' || status === 'IN_PROGRESS') return 1;
  if (status === 'COMPLETED') return 3;
  return 0;
}

function statusLabel(status: ProductionOrder['status'] | undefined): string {
  switch (status) {
    case 'DRAFT':
      return 'مسودة';
    case 'RELEASED':
      return 'مُفرج';
    case 'IN_PROGRESS':
      return 'قيد التنفيذ';
    case 'COMPLETED':
      return 'منتهية';
    case 'CANCELLED':
      return 'ملغاة';
    default:
      return '—';
  }
}

export default function ManufacturingOperationPage() {
  useBackendReachability();
  const invalidateQuery = useInvalidateQuery();

  const [serial, setSerial] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [model, setModel] = useState('');
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [numberOfModels, setNumberOfModels] = useState('1');
  const [showCanceled, setShowCanceled] = useState(false);
  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: bomsResponse } = useApiQuery<Bom[]>(['manufacturing-boms'], '/manufacturing/boms');
  const { data: warehousesResponse } = useApiQuery<Warehouse[] | { data: Warehouse[] }>(
    ['warehouses'],
    '/inventory/warehouses',
    { limit: 200 }
  );

  const boms = bomsResponse?.data ?? [];
  const warehouses = Array.isArray(warehousesResponse?.data)
    ? (warehousesResponse?.data as Warehouse[])
    : [];

  const { data: bomDetailResponse } = useApiQuery<Bom>(
    ['manufacturing-bom', model],
    `/manufacturing/boms/${model}`,
    undefined,
    { enabled: !!model }
  );
  const bom = bomDetailResponse?.data ?? null;

  const plannedQuantity = Math.max(0, Number(numberOfModels) || 0);
  const scale = bom && num(bom.baseQuantity) > 0 ? plannedQuantity / num(bom.baseQuantity) : 0;

  const rawMaterials = (bom?.lines ?? []).map((line, index) => {
    const required = num(line.quantity) * scale * (1 + num(line.scrapPercentage) / 100);
    return {
      id: line.id,
      index: index + 1,
      itemName: line.rawItem?.arabicName ?? line.rawItemId,
      quantity: required,
      unit: line.rawItem?.serial ?? '—',
    };
  });

  const laborCost = num(bom?.standardLaborCost) * scale;
  const overheadCost = num(bom?.standardOverheadCost) * scale;
  const materialCost = num(order?.totalMaterialCost);
  const isPosted = !!order && POSTED_STATUSES.includes(order.status);
  const advancedFilledCount = [description, showCanceled].filter(Boolean).length;

  const varianceRows = useMemo(() => {
    const rows: {
      id: string;
      itemName: string;
      estimated: number;
      actual: number;
    }[] = [];

    if (bom?.finishedItem) {
      const estimated = plannedQuantity;
      const actual = num(order?.actualQuantity ?? plannedQuantity);
      rows.push({
        id: 'finished',
        itemName: bom.finishedItem.arabicName,
        estimated,
        actual,
      });
    }

    for (const line of bom?.lines ?? []) {
      const estimated = num(line.quantity) * scale * (1 + num(line.scrapPercentage) / 100);
      const actual = isPosted ? estimated : estimated;
      rows.push({
        id: line.id,
        itemName: line.rawItem?.arabicName ?? line.rawItemId,
        estimated,
        actual,
      });
    }

    return rows;
  }, [bom, plannedQuantity, order?.actualQuantity, scale, isPosted]);

  const costSlices = useMemo(() => {
    const materials = materialCost > 0 ? materialCost : 0;
    const labor = num(order?.totalLaborCost) || laborCost;
    const overhead = num(order?.totalOverheadCost) || overheadCost;
    return [
      { id: 'materials', label: 'المواد الخام', value: materials, color: '#0E79AA' },
      { id: 'labor', label: 'أجور مباشرة', value: labor, color: '#38bdf8' },
      { id: 'overhead', label: 'مصاريف صناعية', value: overhead, color: '#94a3b8' },
    ];
  }, [materialCost, laborCost, overheadCost, order?.totalLaborCost, order?.totalOverheadCost]);

  const createOrderMutation = useApiMutation<{ data: ProductionOrder }, Record<string, unknown>>(
    '/manufacturing/orders',
    'POST',
    {
      onSuccess: (res) => {
        const created = (res as unknown as { data: ProductionOrder }).data;
        setOrder(created);
        setSerial(created.orderNumber);
        setSuccess('تم حفظ أمر التصنيع');
        invalidateQuery(['manufacturing-orders']);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر حفظ أمر التصنيع'),
    }
  );

  function resetFeedback() {
    setError(null);
    setSuccess(null);
  }

  async function handleSave() {
    resetFeedback();
    if (!model) return setError('اختر النموذج (قائمة المواد) أولاً');
    if (!fromWarehouse) return setError('اختر مخزن الخامات');
    if (plannedQuantity <= 0) return setError('أدخل عدد النماذج');

    await createOrderMutation.mutateAsync({
      orderNumber: serial.trim() || `MO-${Date.now()}`,
      bomId: model,
      plannedQuantity,
      warehouseIdRaw: fromWarehouse,
      warehouseIdFinished: fromWarehouse,
    });
  }

  async function handlePost() {
    resetFeedback();
    if (!order) return setError('احفظ أمر التصنيع قبل الترحيل');
    setBusy(true);
    try {
      if (order.status === 'DRAFT') {
        await apiClient.post(`/manufacturing/orders/${order.id}/release`);
      }
      const issued = await apiClient.post<ProductionOrder>(
        `/manufacturing/orders/${order.id}/issue-materials`
      );
      setOrder(issued.data);

      if (laborCost > 0 || overheadCost > 0) {
        const withCosts = await apiClient.post<ProductionOrder>(
          `/manufacturing/orders/${order.id}/add-costs`,
          { laborCost, overheadCost }
        );
        setOrder(withCosts.data);
      }
      setSuccess('تم ترحيل صرف الخامات والتكاليف');
    } catch (err) {
      setError((err as ApiError).message || 'تعذر ترحيل العملية');
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    resetFeedback();
    if (!order) return setError('احفظ أمر التصنيع قبل الإنهاء');
    setBusy(true);
    try {
      const completed = await apiClient.post<ProductionOrder>(
        `/manufacturing/orders/${order.id}/complete`,
        { actualQuantity: plannedQuantity }
      );
      setOrder(completed.data);
      setSuccess('تم إنهاء التصنيع وإضافة الأصناف الناتجة للمخزن');
    } catch (err) {
      setError((err as ApiError).message || 'تعذر إنهاء التصنيع');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ManufacturingPageChrome
      title="أمر التشغيل"
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
      savePending={createOrderMutation.isPending || busy}
      canSave={!order}
      saveLabel="حفظ أمر التصنيع"
      extraActions={
        <div className="flex flex-wrap items-center gap-2">
          {order ? (
            <Button
              onClick={() => {
                setOrder(null);
                setSerial('');
                resetFeedback();
              }}
              size="sm"
              variant="secondary"
            >
              أمر جديد
            </Button>
          ) : null}
          <Button
            onClick={() => void handlePost()}
            disabled={!order || isPosted || busy}
            size="sm"
            className="bg-[#0E79AA] hover:bg-[#0B6188]"
          >
            ترحيل صرف الخامات
          </Button>
          <Button
            onClick={() => void handleComplete()}
            disabled={!order || order.status !== 'IN_PROGRESS' || busy}
            size="sm"
            variant="secondary"
          >
            إنهاء التصنيع
          </Button>
        </div>
      }
    >
      <div className="rounded-2xl border border-[#D6EAF3] bg-white p-4 shadow-sm">
        <WorkflowStepper steps={WORKFLOW_STEPS} currentIndex={statusToStepIndex(order?.status)} />
      </div>

      <FormSectionCard
        title="بيانات الأمر"
        subtitle="المسلسل والنموذج والمخزن والكمية المخططة"
        bodyClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      >
        <CompactFormField
          label="المسلسل"
          placeholder="ادخل المسلسل"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />
        <CompactFormField
          label="التاريخ"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <CompactFormField label="نموذج (BOM)" required>
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setOrder(null);
            }}
            disabled={!!order}
            className={compactControlClass}
          >
            <option value="">اختر النموذج</option>
            {boms.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.finishedItem ? ` — ${b.finishedItem.arabicName}` : ''}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField label="من مخزن" required>
          <select
            value={fromWarehouse}
            onChange={(e) => setFromWarehouse(e.target.value)}
            disabled={!!order}
            className={compactControlClass}
          >
            <option value="">اختر المخزن</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.arabicName ?? w.name ?? w.code}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField
          label="الكمية المخططة"
          type="number"
          min={0}
          step="0.0001"
          value={numberOfModels}
          onChange={(e) => setNumberOfModels(e.target.value)}
        />
        {order ? <CompactFormField label="رقم الأمر" value={order.orderNumber} readOnly /> : null}
      </FormSectionCard>

      <AdvancedFieldsSection badgeCount={advancedFilledCount}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CompactFormField
            label="الشرح"
            placeholder="إدخل الشرح"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <CompactFormField label="العملة" value="الجنية المصري" readOnly />
          <Switch label="عرض الملغي" checked={showCanceled} onCheckedChange={setShowCanceled} />
        </div>
      </AdvancedFieldsSection>

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
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MfgTableCard title="أصناف ناتجة">
          <table className={mfgTableClass}>
            <thead className={mfgTheadClass}>
              <tr>
                <th className={mfgThClass}>م</th>
                <th className={mfgThClass}>إسم الصنف</th>
                <th className={cn(mfgThClass, 'min-w-[100px]')}>الكمية</th>
                <th className={mfgThClass}>الوحدة</th>
                <th className={cn(mfgThClass, 'min-w-[100px]')}>سعر</th>
                <th className={cn(mfgThClass, 'min-w-[140px]')}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {bom?.finishedItem ? (
                <tr className={mfgTrClass}>
                  <td className={mfgTdClass}>1</td>
                  <td className={mfgTdClass}>{bom.finishedItem.arabicName}</td>
                  <td className={cn(mfgTdClass, 'tabular-nums')}>
                    {fmt(num(order?.actualQuantity ?? plannedQuantity))}
                  </td>
                  <td className={mfgTdClass}>{bom.finishedItem.serial ?? '—'}</td>
                  <td className={cn(mfgTdClass, 'tabular-nums')}>
                    {order?.unitCost ? fmt(num(order.unitCost)) : '—'}
                  </td>
                  <td className={cn(mfgTdClass, 'tabular-nums')}>
                    {order?.unitCost
                      ? fmt(num(order.unitCost) * num(order.actualQuantity ?? plannedQuantity))
                      : '—'}
                  </td>
                </tr>
              ) : (
                <MfgEmptyRow colSpan={6}>اختر نموذجاً لعرض الأصناف الناتجة</MfgEmptyRow>
              )}
            </tbody>
          </table>
        </MfgTableCard>

        <MfgTableCard title="أصناف الخامات الأولية">
          <table className={mfgTableClass}>
            <thead className={mfgTheadClass}>
              <tr>
                <th className={mfgThClass}>م</th>
                <th className={mfgThClass}>إسم الصنف</th>
                <th className={cn(mfgThClass, 'min-w-[100px]')}>الكمية</th>
                <th className={mfgThClass}>الوحدة</th>
                <th className={cn(mfgThClass, 'min-w-[100px]')}>سعر الوحدة</th>
                <th className={cn(mfgThClass, 'min-w-[140px]')}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.length === 0 ? (
                <MfgEmptyRow colSpan={6}>اختر نموذجاً وعدد النماذج لعرض احتياج الخامات</MfgEmptyRow>
              ) : (
                rawMaterials.map((row) => (
                  <tr key={row.id} className={mfgTrClass}>
                    <td className={mfgTdClass}>{row.index}</td>
                    <td className={mfgTdClass}>{row.itemName}</td>
                    <td className={cn(mfgTdClass, 'tabular-nums')}>{fmt(row.quantity)}</td>
                    <td className={mfgTdClass}>{row.unit}</td>
                    <td className={mfgTdClass}>{isPosted ? '—' : 'يُحسب عند الصرف'}</td>
                    <td className={mfgTdClass}>—</td>
                  </tr>
                ))
              )}
              {rawMaterials.length > 0 ? (
                <tr className={cn(mfgTrClass, 'bg-[#F8FBFD] font-semibold')}>
                  <td colSpan={5} className={cn(mfgTdClass, 'text-left')}>
                    الإجمالي
                  </td>
                  <td className={cn(mfgTdClass, 'tabular-nums')}>
                    {materialCost > 0 ? fmt(materialCost) : '—'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </MfgTableCard>
      </div>

      <MfgTableCard title="مقارنة الفعلي بالتقديري">
        <table className={mfgTableClass}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={mfgThClass}>الصنف</th>
              <th className={cn(mfgThClass, 'min-w-[100px]')}>التقديري</th>
              <th className={cn(mfgThClass, 'min-w-[100px]')}>الفعلي</th>
              <th className={cn(mfgThClass, 'min-w-[100px]')}>الانحراف</th>
              <th className={cn(mfgThClass, 'min-w-[100px]')}>نسبة الانحراف</th>
            </tr>
          </thead>
          <tbody>
            {varianceRows.length === 0 ? (
              <MfgEmptyRow colSpan={5}>اختر نموذجاً لعرض المقارنة</MfgEmptyRow>
            ) : (
              varianceRows.map((row) => {
                const variance = row.actual - row.estimated;
                const variancePct =
                  row.estimated !== 0 ? (variance / row.estimated) * 100 : variance !== 0 ? 100 : 0;
                const highlight = Math.abs(variance) > 0.001;
                return (
                  <tr key={row.id} className={mfgTrClass}>
                    <td className={mfgTdClass}>{row.itemName}</td>
                    <td className={cn(mfgTdClass, 'tabular-nums')}>{fmt(row.estimated)}</td>
                    <td className={cn(mfgTdClass, 'tabular-nums')}>{fmt(row.actual)}</td>
                    <td className={cn(mfgTdClass, 'tabular-nums font-semibold', highlight && 'text-rose-600')}>
                      {fmt(variance)}
                    </td>
                    <td className={cn(mfgTdClass, 'tabular-nums font-semibold', highlight && 'text-rose-600')}>
                      {fmtPct(variancePct)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </MfgTableCard>

      <CostRollupCard slices={costSlices} />
    </ManufacturingPageChrome>
  );
}
