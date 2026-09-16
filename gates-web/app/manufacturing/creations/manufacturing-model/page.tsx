'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  compactControlClass,
  CostRollupCard,
  ActionButtons,
  Button,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { CommandCenter } from '@/components/dashboard-primitives';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { cn } from '@/lib/utils';

type ComponentLine = {
  rawItemId: string;
  quantity: string;
  scrapPercentage: string;
};

function calcLineQty(quantity: string, scrapPercentage: string): number {
  const qty = Number(quantity);
  const scrap = Number(scrapPercentage) || 0;
  if (!Number.isFinite(qty)) return 0;
  return qty * (1 + scrap / 100);
}

export default function ManufacturingModelPage() {
  useBackendReachability();
  const invalidateQuery = useInvalidateQuery();

  const [serial, setSerial] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('');
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [finishedItemId, setFinishedItemId] = useState('');
  const [baseQuantity, setBaseQuantity] = useState('1');
  const [laborCost, setLaborCost] = useState('0');
  const [overheadCost, setOverheadCost] = useState('0');
  const [stage, setStage] = useState('');
  const [componentLines, setComponentLines] = useState<ComponentLine[]>([
    { rawItemId: '', quantity: '1', scrapPercentage: '0' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: itemsResponse } = useApiQuery<Array<{ id: string; arabicName: string; serial?: string | null }>>(
    ['inventory-items-bom'],
    '/inventory/items',
    { limit: 300 }
  );
  const items = itemsResponse?.data ?? [];

  const createBomMutation = useApiMutation<{ data: { id: string; name: string } }, Record<string, unknown>>(
    '/manufacturing/boms',
    'POST',
    {
      onSuccess: (res) => {
        const created = (res as unknown as { data: { id: string; name: string } }).data;
        setModel(created.id);
        setSuccess('تم حفظ نموذج التصنيع (BOM)');
        invalidateQuery(['manufacturing-boms']);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر حفظ النموذج'),
    }
  );

  const finishedItem = items.find((it) => it.id === finishedItemId);
  const advancedFilledCount = [fromWarehouse, costCenter, stage, model].filter(Boolean).length;

  const labor = Number(laborCost) || 0;
  const overhead = Number(overheadCost) || 0;
  const filledLineCount = componentLines.filter((l) => l.rawItemId).length;

  const costSlices = useMemo(
    () => [
      { id: 'materials', label: 'المواد الخام', value: 0, color: '#0E79AA' },
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

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    if (!finishedItemId) return setError('اختر الصنف الناتج');

    const filledLines = componentLines.filter((l) => l.rawItemId.trim());
    if (filledLines.length === 0) return setError('اختر مادة خام واحدة على الأقل');

    for (const line of filledLines) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) return setError('كمية المادة الخام غير صالحة');
    }

    const baseQty = Number(baseQuantity);
    if (!Number.isFinite(baseQty) || baseQty <= 0) return setError('الكمية الأساسية غير صالحة');

    await createBomMutation.mutateAsync({
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
    });
  };

  return (
    <CommandCenter
      title="نموذج التصنيع / بطاقة تجميع منتج"
      module="MFG / BOM"
      shortcuts={[
        { key: 'F8', label: 'التشغيل', href: '/manufacturing' },
        { key: 'F2', label: 'أمر تشغيل', href: '/manufacturing/operations/operation' },
      ]}
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
            <CompactFormField label="معرّف النموذج">
              <select value={model} onChange={(e) => setModel(e.target.value)} className={compactControlClass}>
                <option value="">— بعد الحفظ —</option>
                {model ? <option value={model}>{model}</option> : null}
              </select>
            </CompactFormField>
          </div>
        </AdvancedFieldsSection>

        <FormSectionCard
          title="مكونات التجميع"
          subtitle="المواد الخام والكميات القياسية ونسبة الهالك"
          bodyClassName="block"
          className="border-slate-200/80 bg-white dark:bg-slate-900"
        >
          <div className={denseTableWrapClass}>
            <table className={denseTableClass}>
              <thead className={denseTheadClass}>
                <tr>
                  <th className={cn(denseThClass, 'w-10')}>م</th>
                  <th className={denseThClass}>المادة الخام</th>
                  <th className={cn(denseThClass, 'min-w-[100px]')}>الكمية القياسية</th>
                  <th className={cn(denseThClass, 'min-w-[100px]')}>نسبة الهالك %</th>
                  <th className={cn(denseThClass, 'min-w-[140px]')}>الكمية المحسوبة</th>
                  <th className={cn(denseThClass, 'w-12')} />
                </tr>
              </thead>
              <tbody>
                {componentLines.map((line, index) => (
                  <tr key={index} className={denseTrClass}>
                    <td className={denseTdClass}>{index + 1}</td>
                    <td className={denseTdClass}>
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
                    <td className={denseTdClass}>
                      <input
                        type="number"
                        min={0}
                        step="0.0001"
                        value={line.quantity}
                        onChange={(e) => updateComponentLine(index, { quantity: e.target.value })}
                        className={compactControlClass}
                      />
                    </td>
                    <td className={denseTdClass}>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.scrapPercentage}
                        onChange={(e) => updateComponentLine(index, { scrapPercentage: e.target.value })}
                        className={compactControlClass}
                      />
                    </td>
                    <td className={cn(denseTdClass, 'tabular-nums font-semibold text-[#0E79AA]')}>
                      {calcLineQty(line.quantity, line.scrapPercentage).toLocaleString('en-US', {
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className={denseTdClass}>
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
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addComponentLine}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              إضافة مادة
            </Button>
          </div>
        </FormSectionCard>

        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200/80 bg-white p-4 dark:bg-slate-900">
            <h3 className="mb-3 text-sm font-bold text-slate-900">أصناف ناتجة</h3>
            <div className={denseTableWrapClass}>
              <table className={denseTableClass}>
                <thead className={denseTheadClass}>
                  <tr>
                    <th className={denseThClass}>م</th>
                    <th className={denseThClass}>إسم الصنف</th>
                    <th className={cn(denseThClass, 'min-w-[100px]')}>الكمية</th>
                    <th className={denseThClass}>الوحدة</th>
                  </tr>
                </thead>
                <tbody>
                  {finishedItem ? (
                    <tr className={denseTrClass}>
                      <td className={denseTdClass}>1</td>
                      <td className={denseTdClass}>{finishedItem.arabicName}</td>
                      <td className={cn(denseTdClass, 'tabular-nums')}>{baseQuantity || '—'}</td>
                      <td className={denseTdClass}>{finishedItem.serial ?? '—'}</td>
                    </tr>
                  ) : (
                    <tr className={denseTrClass}>
                      <td colSpan={4} className="px-3 py-6 text-center text-xs text-slate-500">
                        اختر الصنف الناتج لعرض النتيجة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

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

        <div className="flex justify-end">
          <ActionButtons
            onSave={() => void handleSave()}
            saveText={createBomMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            saveLoading={createBomMutation.isPending}
          />
        </div>

        {error && <ErrorToast message={error} onClose={() => setError(null)} />}
        {success && <SuccessToast message={success} onClose={() => setSuccess(null)} />}
    </CommandCenter>
  );
}
