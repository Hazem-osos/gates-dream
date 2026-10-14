'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { COST_ELEMENT_AR } from '@/components/contracting/tender/tender-labels';
import { formatEgp } from '@/lib/subcontracts/money';

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
  const [editingId, setEditingId] = useState<string | null>(null);
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
    onSuccess: () => {
      invalidate(key);
      setEditingId(null);
      setForm(empty);
    },
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/contracting/cost-element-catalog/${id}`),
    onSuccess: () => invalidate(key),
  });

  const rows = q.data?.data ?? [];
  const body = {
    costElementType,
    resourceCode: form.resourceCode,
    descriptionAr: form.descriptionAr,
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
      hideSave
      favoriteHref={href}
    >
      <p className="mb-3 text-sm text-slate-600">
        عناصر {COST_ELEMENT_AR[costElementType]} للاستخدام في تحليل سعر العطاء. الخدمات تُحفظ كـ مقاول باطن.
      </p>
      <div className="mb-4 rounded-2xl border bg-white p-4 space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-5">
          <input className="rounded border px-2 py-1" placeholder="الكود" value={form.resourceCode} onChange={(e) => setForm({ ...form, resourceCode: e.target.value })} />
          <input className="rounded border px-2 py-1 sm:col-span-2" placeholder="البيان" value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} />
          <input className="rounded border px-2 py-1" placeholder="الوحدة" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <input className="rounded border px-2 py-1" type="number" placeholder="سعر الوحدة" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
          <input className="rounded border px-2 py-1 sm:col-span-2" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        {editingId ? (
          <div className="flex gap-2">
            <Button type="button" onClick={() => patch.mutate({ id: editingId, body })}>
              حفظ التعديل
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(empty); }}>
              إلغاء
            </Button>
          </div>
        ) : (
          <Button type="button" disabled={!form.resourceCode.trim() || !form.descriptionAr.trim() || create.isPending} onClick={() => create.mutate(body)}>
            إضافة للدليل
          </Button>
        )}
      </div>
      <AppTable
        columns={[
          { id: 'code', header: 'الكود', accessor: 'resourceCode' },
          { id: 'ar', header: 'البيان', accessor: 'descriptionAr' },
          { id: 'unit', header: 'الوحدة', accessor: 'unit' },
          { id: 'cost', header: 'سعر الوحدة', numeric: true, cell: (r) => formatEgp(r.unitCost) },
          { id: 'notes', header: 'ملاحظات', accessor: 'notes' },
          {
            id: 'actions',
            header: '',
            cell: (r) => (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-brand text-xs underline"
                  onClick={() => {
                    setEditingId(r.id);
                    setForm({
                      resourceCode: r.resourceCode,
                      descriptionAr: r.descriptionAr,
                      unit: r.unit,
                      unitCost: String(r.unitCost ?? ''),
                      notes: r.notes ?? '',
                    });
                  }}
                >
                  تعديل
                </button>
                <button type="button" className="text-red-600 text-xs" onClick={() => deactivate.mutate(r.id)}>
                  إيقاف
                </button>
              </div>
            ),
          },
        ]}
        data={rows}
        getRowKey={(r) => r.id}
        isLoading={q.isLoading}
        emptyTitle="الدليل فارغ"
        emptyDescription="أضف عناصر ثم اخترها من تحليل سعر العطاء."
        exportFileName={`cost-element-${costElementType.toLowerCase()}`}
      />
    </ExtractsPageChrome>
  );
}
