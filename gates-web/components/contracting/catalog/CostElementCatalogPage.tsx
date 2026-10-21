'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { COST_ELEMENT_AR } from '@/components/contracting/tender/tender-labels';
import { formatEgp } from '@/lib/subcontracts/money';
import {
  dataEntryGridBodyCellClass,
  dataEntryGridHeadCellClass,
  dataEntryGridHeadRowClass,
  dataEntryGridInputClass,
  dataEntryGridNumericInputClass,
  dataEntryGridWrapClass,
} from '@/components/ui/data-entry-grid/tokens';


type Row = {
  id: string;
  resourceCode: string;
  descriptionAr: string;
  unit: string;
  unitCost: string | number;
  notes?: string | null;
};

const empty = { resourceCode: '', descriptionAr: '', unit: 'ITEM', unitCost: '', notes: '' };

export function CostElementCatalogPage({
  costElementType,
  title,
  href,
}: {
  costElementType: 'MATERIAL' | 'LABOR' | 'EQUIPMENT' | 'SITE_EXPENSE' | 'SUBCONTRACTOR';
  title: string;
  href: string;
}) {
  const invalidate = useInvalidateQuery();
  const [form, setForm] = useState(empty);
  const key = ['contracting-cost-element-catalog', costElementType];
  const q = useApiQuery<Row[]>(key, '/contracting/cost-element-catalog', { type: costElementType });
  const create = useApiMutation<Row, Record<string, unknown>>('/contracting/cost-element-catalog', 'POST', {
    onSuccess: () => {
      invalidate(key);
      setForm(empty);
    },
  });
  const patch = useMutation({
    mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
      apiClient.patch(`/contracting/cost-element-catalog/${input.id}`, input.body),
    onSuccess: () => invalidate(key),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/contracting/cost-element-catalog/${id}`),
    onSuccess: () => invalidate(key),
  });

  const rows = q.data?.data ?? [];
  const addBody = {
    costElementType,
    resourceCode: form.resourceCode.trim(),
    descriptionAr: form.descriptionAr.trim(),
    unit: form.unit,
    unitCost: Number(form.unitCost || 0),
    notes: form.notes || undefined,
  };

  return (
    <ExtractsPageChrome
      title={title}
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { label: title },
      ]}
      favoriteHref={href}
      onNew={() => setForm(empty)}
      onSave={() => {
        if (addBody.resourceCode && addBody.descriptionAr) create.mutate(addBody);
      }}
      savePending={create.isPending}
      canSave={Boolean(addBody.resourceCode && addBody.descriptionAr)}
      saveLabel="إضافة سطر"
      moreMenuItems={[{ id: 'refresh', label: 'تحديث', onClick: () => invalidate(key) }]}
    >
      <p className="mb-3 text-sm text-slate-600">
        أدخل البيانات في الجدول مباشرة. عناصر {COST_ELEMENT_AR[costElementType]} تظهر في تحليل سعر العطاء. الخدمات تُحفظ كمقاول باطن.
      </p>
      <div className={dataEntryGridWrapClass}>
        <table className="min-w-full text-sm">
          <thead className={dataEntryGridHeadRowClass}>
            <tr>
              <th className={dataEntryGridHeadCellClass}>الكود</th>
              <th className={dataEntryGridHeadCellClass}>البيان</th>
              <th className={dataEntryGridHeadCellClass}>الوحدة</th>
              <th className={dataEntryGridHeadCellClass}>سعر الوحدة</th>
              <th className={dataEntryGridHeadCellClass}>ملاحظات</th>
              <th className={dataEntryGridHeadCellClass} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={dataEntryGridBodyCellClass}>
                  <input
                    className={dataEntryGridInputClass}
                    defaultValue={r.resourceCode}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== r.resourceCode) patch.mutate({ id: r.id, body: { resourceCode: v } });
                    }}
                  />
                </td>
                <td className={dataEntryGridBodyCellClass}>
                  <input
                    className={dataEntryGridInputClass}
                    defaultValue={r.descriptionAr}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== r.descriptionAr) patch.mutate({ id: r.id, body: { descriptionAr: v } });
                    }}
                  />
                </td>
                <td className={dataEntryGridBodyCellClass}>
                  <input
                    className={dataEntryGridInputClass}
                    defaultValue={r.unit}
                    onBlur={(e) => {
                      if (e.target.value !== r.unit) patch.mutate({ id: r.id, body: { unit: e.target.value } });
                    }}
                  />
                </td>
                <td className={dataEntryGridBodyCellClass}>
                  <input
                    type="number"
                    className={dataEntryGridNumericInputClass}
                    defaultValue={Number(r.unitCost)}
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n !== Number(r.unitCost)) patch.mutate({ id: r.id, body: { unitCost: n } });
                    }}
                  />
                </td>
                <td className={dataEntryGridBodyCellClass}>
                  <input
                    className={dataEntryGridInputClass}
                    defaultValue={r.notes ?? ''}
                    onBlur={(e) => {
                      if (e.target.value !== (r.notes ?? '')) patch.mutate({ id: r.id, body: { notes: e.target.value } });
                    }}
                  />
                </td>
                <td className={dataEntryGridBodyCellClass}>
                  <button type="button" className="text-xs text-red-600" onClick={() => deactivate.mutate(r.id)}>
                    إيقاف
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-[#F6FBFD]">
              <td className={dataEntryGridBodyCellClass}>
                <input className={dataEntryGridInputClass} placeholder="كود جديد" value={form.resourceCode} onChange={(e) => setForm({ ...form, resourceCode: e.target.value })} />
              </td>
              <td className={dataEntryGridBodyCellClass}>
                <input className={dataEntryGridInputClass} placeholder="البيان" value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} />
              </td>
              <td className={dataEntryGridBodyCellClass}>
                <input className={dataEntryGridInputClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </td>
              <td className={dataEntryGridBodyCellClass}>
                <input type="number" className={dataEntryGridNumericInputClass} placeholder="0" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
              </td>
              <td className={dataEntryGridBodyCellClass}>
                <input className={dataEntryGridInputClass} placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </td>
              <td className={dataEntryGridBodyCellClass}>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1 text-xs font-semibold"
                  disabled={!addBody.resourceCode || !addBody.descriptionAr || create.isPending}
                  onClick={() => create.mutate(addBody)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="mt-2 text-xs text-slate-500">لا توجد عناصر بعد — اكتب في الصف الأخير ثم أضف.</p> : null}
      <p className="mt-2 text-xs text-slate-400">سعر الوحدة المعروض للمراجعة: {form.unitCost ? formatEgp(form.unitCost) : '—'}</p>
    </ExtractsPageChrome>
  );
}
