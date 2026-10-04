'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  compactControlClass,
  CostRollupCard,
  Button,
} from '@/components/ui';
import {
  ManufacturingPageChrome,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgThClass,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { PageSkeleton } from '@/components/ui/skeletons';

type ComponentLine = {
  rawItemId: string;
  quantity: string;
  scrapPercentage: string;
};

type BomDetail = {
  id: string;
  name: string;
  finishedItemId: string;
  baseQuantity: string | number;
  standardLaborCost: string | number;
  standardOverheadCost: string | number;
  finishedItem?: { id: string; arabicName: string; serial?: string | null };
  lines?: Array<{
    rawItemId: string;
    quantity: string | number;
    scrapPercentage: string | number;
    lineOrder?: number;
  }>;
};

function calcLineQty(quantity: string, scrapPercentage: string): number {
  const qty = Number(quantity);
  const scrap = Number(scrapPercentage) || 0;
  if (!Number.isFinite(qty)) return 0;
  return qty * (1 + scrap / 100);
}

function emptyLines(): ComponentLine[] {
  return [{ rawItemId: '', quantity: '1', scrapPercentage: '0' }];
}

export default function ManufacturingModelPage() {
  useBackendReachability();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateQuery = useInvalidateQuery();

  const idFromUrl = searchParams.get('id')?.trim() || null;
  const [bomId, setBomId] = useState<string | null>(idFromUrl);
  const hydratedRef = useRef<string | null>(null);

  const [serial, setSerial] = useState('');
  const [description, setDescription] = useState('');
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [finishedItemId, setFinishedItemId] = useState('');
  const [baseQuantity, setBaseQuantity] = useState('1');
  const [laborCost, setLaborCost] = useState('0');
  const [overheadCost, setOverheadCost] = useState('0');
  const [stage, setStage] = useState('');
  const [componentLines, setComponentLines] = useState<ComponentLine[]>(emptyLines);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBomId(idFromUrl);
    if (!idFromUrl) hydratedRef.current = null;
  }, [idFromUrl]);

  const openBom = (id: string | null) => {
    setBomId(id);
    if (id) router.replace(`/manufacturing/creations/manufacturing-model?id=${encodeURIComponent(id)}`, { scroll: false });
    else router.replace('/manufacturing/creations/manufacturing-model', { scroll: false });
  };

  const { data: itemsResponse } = useApiQuery<Array<{ id: string; arabicName: string; serial?: string | null }>>(
    ['inventory-items-bom'],
    '/inventory/items',
    { limit: 300 }
  );
  const items = itemsResponse?.data ?? [];

  const { data: bomListResponse } = useApiQuery<Array<{ id: string; name: string }>>(
    ['manufacturing-boms'],
    '/manufacturing/boms'
  );
  const bomList = bomListResponse?.data ?? [];

  const { data: bomDetailResponse, isLoading: bomLoading } = useApiQuery<BomDetail>(
    ['manufacturing-bom', bomId],
    `/manufacturing/boms/${bomId}`,
    undefined,
    { enabled: Boolean(bomId) }
  );
  const bomDetail = bomDetailResponse?.data ?? null;

  useEffect(() => {
    if (!bomId || !bomDetail || bomDetail.id !== bomId) return;
    if (hydratedRef.current === bomId) return;
    hydratedRef.current = bomId;
    setDescription(bomDetail.name ?? '');
    setSerial(bomDetail.finishedItem?.serial ?? '');
    setFinishedItemId(bomDetail.finishedItemId);
    setBaseQuantity(String(bomDetail.baseQuantity ?? '1'));
    setLaborCost(String(bomDetail.standardLaborCost ?? '0'));
    setOverheadCost(String(bomDetail.standardOverheadCost ?? '0'));
    const lines = (bomDetail.lines ?? []).map((line) => ({
      rawItemId: line.rawItemId,
      quantity: String(line.quantity ?? '1'),
      scrapPercentage: String(line.scrapPercentage ?? '0'),
    }));
    setComponentLines(lines.length > 0 ? lines : emptyLines());
  }, [bomId, bomDetail]);

  const createBomMutation = useApiMutation<{ id: string; name: string }, Record<string, unknown>>(
    '/manufacturing/boms',
    'POST',
    {
      onSuccess: (res) => {
        const created = (res as unknown as { data: { id: string; name: string } }).data;
        setSuccess('تم حفظ نموذج التصنيع (BOM)');
        invalidateQuery(['manufacturing-boms']);
        invalidateQuery(['manufacturing-bom', created.id]);
        hydratedRef.current = null;
        openBom(created.id);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر حفظ النموذج'),
    }
  );

  const finishedItem = items.find((it) => it.id === finishedItemId);
  const advancedFilledCount = [fromWarehouse, costCenter, stage, bomId].filter(Boolean).length;

  const labor = Number(laborCost) || 0;
  const overhead = Number(overheadCost) || 0;
  const filledLineCount = componentLines.filter((l) => l.rawItemId).length;

  const costSlices = useMemo(
    () => [
      { id: 'materials', label: 'المواد الخام', value: 0, color: '#0E78AA' },
      { id: 'labor', label: 'أجور مباشرة', value: labor, color: '#38bdf8' },
      { id: 'overhead', label: 'مصاريف صناعية', value: overhead, color: '#94a3b8' },
    ],
    [labor, overhead]
  );

  function updateComponentLine(index: number, patch: Partial<ComponentLine>) {
    setComponentLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addComponentLine() {
    setComponentLines((prev) => [...prev, { rawItemId: '', quantity: '1', scrapPercentage: '0' }]);
  }

  function removeComponentLine(index: number) {
    if (componentLines.length <= 1) return;
    setComponentLines((prev) => prev.filter((_, i) => i !== index));
  }

  function buildPayload(): Record<string, unknown> | null {
    if (!finishedItemId) {
      setError('اختر الصنف الناتج');
      return null;
    }
    const filledLines = componentLines.filter((l) => l.rawItemId.trim());
    if (filledLines.length === 0) {
      setError('اختر مادة خام واحدة على الأقل');
      return null;
    }
    for (const line of filledLines) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError('كمية المادة الخام غير صالحة');
        return null;
      }
    }
    const baseQty = Number(baseQuantity);
    if (!Number.isFinite(baseQty) || baseQty <= 0) {
      setError('الكمية الأساسية غير صالحة');
      return null;
    }
    return {
      name: description.trim() || serial.trim() || `BOM-${Date.now()}`,
      finishedItemId,
      baseQuantity: baseQty,
      standardLaborCost: Number(laborCost) || 0,
      standardOverheadCost: Number(overheadCost) || 0,
      lines: filledLines.map((line, i) => ({
        rawItemId: line.rawItemId,
        quantity: Number(line.quantity),
        scrapPercentage: Number(line.scrapPercentage) || 0,
        lineOrder: i + 1,
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
        setSuccess('تم تحديث نموذج التصنيع (BOM)');
        invalidateQuery(['manufacturing-boms']);
        invalidateQuery(['manufacturing-bom', bomId]);
        hydratedRef.current = null;
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
    hydratedRef.current = null;
    setDescription('');
    setSerial('');
    setFinishedItemId('');
    setBaseQuantity('1');
    setLaborCost('0');
    setOverheadCost('0');
    setComponentLines(emptyLines());
    setFromWarehouse('');
    setCostCenter('');
    setStage('');
    openBom(null);
  };

  if (bomId && bomLoading && !bomDetail) {
    return <PageSkeleton />;
  }

  return (
    <ManufacturingPageChrome
      title="نموذج التصنيع"
      statusLabel={bomId ? 'محفوظ' : 'جديد'}
      docNumber={serial || undefined}
      currentId={bomId}
      favoriteHref="/manufacturing/creations/manufacturing-model"
      onSave={() => void handleSave()}
      savePending={createBomMutation.isPending || saving}
      saveLabel={bomId ? 'تحديث النموذج' : 'حفظ النموذج'}
      extraActions={
        bomId ? (
          <Button type="button" variant="secondary" size="sm" onClick={handleNew}>
            جديد
          </Button>
        ) : null
      }
    >
        <FormSectionCard
          title="البيانات الأساسية"
          subtitle="المسلسل والصنف الناتج والكمية الأساسية"
        >
          <CompactFormField
            label="المسلسل"
            placeholder="إدخل المسلسل"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
          />
          <CompactFormField
            label="الشرح"
            placeholder="إدخل الشرح"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <CompactFormField label="الصنف الناتج" required>
            <select
              value={finishedItemId}
              onChange={(e) => setFinishedItemId(e.target.value)}
              className={compactControlClass}
            >
              <option value="">اختر الصنف</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.arabicName}
                  {it.serial ? ` (${it.serial})` : ''}
                </option>
              ))}
            </select>
          </CompactFormField>
          <CompactFormField
            label="الكمية الأساسية"
            type="number"
            min={0}
            step="0.0001"
            value={baseQuantity}
            onChange={(e) => setBaseQuantity(e.target.value)}
          />
        </FormSectionCard>

        <AdvancedFieldsSection badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompactFormField
              label="من مخزن"
              value={fromWarehouse}
              onChange={(e) => setFromWarehouse(e.target.value)}
            />
            <CompactFormField
              label="مركز التكلفة"
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
            />
            <CompactFormField label="العملة" value="الجنية المصري" readOnly />
            <CompactFormField
              label="المرحلة"
              placeholder="اختر المرحلة"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            />
            <CompactFormField label="قائمة المواد المحفوظة">
              <select
                value={bomId ?? ''}
                onChange={(e) => {
                  const next = e.target.value || null;
                  hydratedRef.current = null;
                  openBom(next);
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
          </div>
        </AdvancedFieldsSection>

        <MfgTableCard
          title="مكونات التجميع"
          toolbar={
            <Button type="button" variant="secondary" size="sm" onClick={addComponentLine} className="gap-1.5">
              <Plus className="h-4 w-4" />
              إضافة مادة
            </Button>
          }
        >
          <table className={mfgTableClass}>
              <thead className={mfgTheadClass}>
                <tr>
                  <th className={cn(mfgThClass, 'w-10')}>م</th>
                  <th className={mfgThClass}>المادة الخام</th>
                  <th className={cn(mfgThClass, 'min-w-[100px]')}>الكمية القياسية</th>
                  <th className={cn(mfgThClass, 'min-w-[100px]')}>نسبة الهالك %</th>
                  <th className={cn(mfgThClass, 'min-w-[140px]')}>الكمية المحسوبة</th>
                  <th className={cn(mfgThClass, 'w-12')} />
                </tr>
              </thead>
              <tbody>
                {componentLines.map((line, index) => (
                  <tr key={index} className={mfgTrClass}>
                    <td className={mfgTdClass}>{index + 1}</td>
                    <td className={mfgTdClass}>
                      <select
                        value={line.rawItemId}
                        onChange={(e) => updateComponentLine(index, { rawItemId: e.target.value })}
                        className={compactControlClass}
                      >
                        <option value="">اختر المادة</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.arabicName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={mfgTdClass}>
                      <input
                        type="number"
                        min={0}
                        step="0.0001"
                        value={line.quantity}
                        onChange={(e) => updateComponentLine(index, { quantity: e.target.value })}
                        className={compactControlClass}
                      />
                    </td>
                    <td className={mfgTdClass}>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.scrapPercentage}
                        onChange={(e) => updateComponentLine(index, { scrapPercentage: e.target.value })}
                        className={compactControlClass}
                      />
                    </td>
                    <td className={cn(mfgTdClass, 'tabular-nums font-semibold text-[#0E78AA]')}>
                      {calcLineQty(line.quantity, line.scrapPercentage).toLocaleString('en-US', {
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className={mfgTdClass}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeComponentLine(index)}
                        disabled={componentLines.length <= 1}
                        className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
                        aria-label="حذف السطر"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </MfgTableCard>

        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MfgTableCard title="أصناف ناتجة">
            <table className={mfgTableClass}>
              <thead className={mfgTheadClass}>
                <tr>
                  <th className={mfgThClass}>م</th>
                  <th className={mfgThClass}>إسم الصنف</th>
                  <th className={cn(mfgThClass, 'min-w-[100px]')}>الكمية</th>
                  <th className={mfgThClass}>الوحدة</th>
                </tr>
              </thead>
              <tbody>
                {finishedItem ? (
                  <tr className={mfgTrClass}>
                    <td className={mfgTdClass}>1</td>
                    <td className={mfgTdClass}>{finishedItem.arabicName}</td>
                    <td className={cn(mfgTdClass, 'tabular-nums')}>{baseQuantity || '—'}</td>
                    <td className={mfgTdClass}>{finishedItem.serial ?? '—'}</td>
                  </tr>
                ) : (
                  <tr className={mfgTrClass}>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                      اختر الصنف الناتج لعرض النتيجة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </MfgTableCard>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <CompactFormField
                label="تكلفة عمالة"
                type="number"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
              />
              <CompactFormField
                label="مصاريف صناعية"
                type="number"
                value={overheadCost}
                onChange={(e) => setOverheadCost(e.target.value)}
              />
            </div>
            <CostRollupCard
              title="تحليل التكلفة القياسية"
              slices={costSlices}
            />
            {filledLineCount > 0 && costSlices[0].value === 0 ? (
              <p className="text-xs text-slate-500">
                {filledLineCount} مادة خام — تُقدّر تكلفة المواد عند ربط أسعار الأصناف
              </p>
            ) : null}
          </div>
        </div>

        {error && <ErrorToast message={error} onClose={() => setError(null)} />}
        {success && <SuccessToast message={success} onClose={() => setSuccess(null)} />}
    </ManufacturingPageChrome>
  );
}
