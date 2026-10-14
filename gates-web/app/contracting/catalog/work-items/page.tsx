'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import {
  BOQ_UNITS,
  CATALOG_KIND_AR,
  CATALOG_KINDS,
} from '@/components/contracting/tender/tender-labels';

type CatalogRow = {
  id: string;
  itemCode: string;
  descriptionAr: string;
  descriptionEn?: string | null;
  unit: string;
  kind: string;
  groupName?: string | null;
  notes?: string | null;
};

const empty = {
  itemCode: '',
  descriptionAr: '',
  descriptionEn: '',
  unit: 'ITEM',
  kind: 'EXECUTABLE',
  groupName: '',
  notes: '',
};

export default function WorkItemCatalogPage() {
  const invalidate = useInvalidateQuery();
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const q = useApiQuery<CatalogRow[]>(['contracting-item-catalog'], '/contracting/item-catalog');
  const create = useApiMutation<CatalogRow, typeof empty>('/contracting/item-catalog', 'POST', {
    onSuccess: () => {
      invalidate(['contracting-item-catalog']);
      setForm(empty);
    },
  });
  const patch = useMutation({
    mutationFn: (input: { id: string; body: typeof empty }) =>
      apiClient.patch(`/contracting/item-catalog/${input.id}`, input.body),
    onSuccess: () => {
      invalidate(['contracting-item-catalog']);
      setEditingId(null);
      setForm(empty);
    },
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/contracting/item-catalog/${id}`),
    onSuccess: () => {
      invalidate(['contracting-item-catalog']);
      setEditingId(null);
      setForm(empty);
    },
  });

  const rows = q.data?.data ?? [];

  return (
    <ExtractsPageChrome
      title="دليل بنود الأعمال"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { label: 'دليل بنود الأعمال' },
      ]}
      hideSave
      favoriteHref="/contracting/catalog/work-items"
    >
      <div className="mb-4 rounded-2xl border bg-white p-4 space-y-3 text-sm">
        <div className="font-bold">{editingId ? 'تعديل بند الدليل' : 'إضافة بند للدليل'}</div>
        <div className="grid gap-2 sm:grid-cols-4">
          <input className="rounded border px-2 py-1" placeholder="الكود (1 / 1.1 / 1.1.1)" value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} />
          <input className="rounded border px-2 py-1 sm:col-span-2" placeholder="البيان العربي" value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} />
          <select className="rounded border px-2 py-1" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {CATALOG_KINDS.map((k) => (
              <option key={k} value={k}>{CATALOG_KIND_AR[k]}</option>
            ))}
          </select>
          <select className="rounded border px-2 py-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            {BOQ_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <input className="rounded border px-2 py-1" placeholder="الموسم / الفصل" value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} />
          <input className="rounded border px-2 py-1" placeholder="الاسم الإنجليزي" value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} />
          <input className="rounded border px-2 py-1 sm:col-span-2" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2">
          {editingId ? (
            <>
              <Button
                type="button"
                onClick={() => editingId && patch.mutate({ id: editingId, body: form })}
                disabled={patch.isPending}
              >
                حفظ التعديل
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(empty);
                }}
              >
                إلغاء
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => create.mutate(form)} disabled={!form.itemCode.trim() || !form.descriptionAr.trim() || create.isPending}>
              إضافة للدليل
            </Button>
          )}
        </div>
      </div>

      <AppTable
        columns={[
          { id: 'code', header: 'الكود', accessor: 'itemCode' },
          { id: 'kind', header: 'النوع', cell: (r) => CATALOG_KIND_AR[r.kind] ?? r.kind },
          { id: 'ar', header: 'البيان', accessor: 'descriptionAr' },
          { id: 'en', header: 'إنجليزي', accessor: 'descriptionEn' },
          { id: 'unit', header: 'الوحدة', accessor: 'unit' },
          { id: 'group', header: 'الموسم / الفصل', accessor: 'groupName' },
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
                      itemCode: r.itemCode,
                      descriptionAr: r.descriptionAr,
                      descriptionEn: r.descriptionEn ?? '',
                      unit: r.unit,
                      kind: r.kind,
                      groupName: r.groupName ?? '',
                      notes: r.notes ?? '',
                    });
                  }}
                >
                  تعديل
                </button>
                <button
                  type="button"
                  className="text-red-600 text-xs"
                  onClick={() => deactivate.mutate(r.id)}
                >
                  إيقاف
                </button>
              </div>
            ),
          },
        ]}
        data={rows}
        getRowKey={(r) => r.id}
        isLoading={q.isLoading}
        emptyTitle="دليل البنود فارغ"
        emptyDescription="أضف موسم / فصل / بند رسمي / بند تنفيذي ثم استخدمه داخل العطاء."
        exportFileName="work-item-catalog"
      />
    </ExtractsPageChrome>
  );
}
