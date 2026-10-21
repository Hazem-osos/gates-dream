'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ListTree } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { confirmAction } from '@/lib/feedback/confirm';
import {
  canEnterBoqLineQuantity,
  isParentIdTreeRowVisible,
  parentIdsWithChildren,
  withItemCodeHierarchy,
  workItemHierarchyHints,
} from '@/lib/contracting/boq-hierarchy';
import { BoqHierarchyTreeCell } from '@/components/contracting/BoqHierarchyTreeCell';
import { inferWorkItemParentId } from '@/lib/contracting/mostakhlasat-contracts';
import { formatEgp, formatQty, toMoney } from '@/lib/subcontracts/money';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

type WorkItemRow = {
  id: string;
  projectId?: string;
  parentId?: string | null;
  isExecutable?: boolean;
  _count?: { children?: number };
  itemNumber: string;
  itemGroupCode?: string | null;
  itemGroupName?: string | null;
  arabicName: string;
  englishName?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unitPrice?: number | string | null;
  totalPrice?: number | string | null;
  notes?: string | null;
};

type ProjectOption = { id: string; arabicName?: string; serial?: string };

const emptyForm = {
  projectId: '',
  itemNumber: '',
  itemGroupCode: '',
  itemGroupName: '',
  arabicName: '',
  englishName: '',
  quantity: '1',
  unit: '',
  unitPrice: '',
  notes: '',
};

export default function GeneralExtractItemsPage() {
  useBackendReachability();
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [codeQ, setCodeQ] = useState('');
  const [arQ, setArQ] = useState('');
  const [enQ, setEnQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(() => new Set());

  const { data: projectsRes } = useApiQuery<ProjectOption[]>(
    ['extracts-projects', 'work-item-create'],
    '/extracts/projects',
    { limit: 500, isActive: true }
  );
  const projects = projectsRes?.data ?? [];

  const { data: itemsResponse, isLoading } = useApiQuery<WorkItemRow[]>(
    ['extract-work-items'],
    '/extracts/work-items',
    { limit: 500, projectId: form.projectId || undefined }
  );
  const tableData = itemsResponse?.data ?? [];
  const filtered = useMemo(() => {
    const c = codeQ.trim().toLowerCase();
    const a = arQ.trim();
    const e = enQ.trim().toLowerCase();
    return tableData.filter((row) => {
      if (c && !(row.itemNumber || '').toLowerCase().includes(c)) return false;
      if (a && !(row.arabicName || '').includes(a)) return false;
      if (e && !(row.englishName || '').toLowerCase().includes(e)) return false;
      return true;
    });
  }, [tableData, codeQ, arQ, enQ]);
  const hierarchical = useMemo(
    () =>
      withItemCodeHierarchy(
        filtered,
        (row) => row.itemNumber || row.itemGroupCode || '',
        workItemHierarchyHints
      ),
    [filtered]
  );

  const workItemById = useMemo(() => {
    const map = new Map<string, WorkItemRow>();
    for (const row of tableData) map.set(row.id, row);
    return map;
  }, [tableData]);

  const parentIdsWithKids = useMemo(() => parentIdsWithChildren(tableData), [tableData]);

  const visibleHierarchical = useMemo(
    () =>
      hierarchical.filter((row) =>
        isParentIdTreeRowVisible(row, expandedParentIds, workItemById)
      ),
    [hierarchical, expandedParentIds, workItemById]
  );

  useEffect(() => {
    const roots = new Set<string>();
    for (const row of tableData) {
      if (!row.parentId && parentIdsWithChildren(tableData).has(row.id)) roots.add(row.id);
    }
    setExpandedParentIds(roots);
  }, [form.projectId, tableData]);

  const selectedHierarchyRow = selectedId
    ? hierarchical.find((row) => row.id === selectedId)
    : null;
  const quantityFieldDisabled = selectedHierarchyRow
    ? !canEnterBoqLineQuantity(selectedHierarchyRow.__isParent)
    : false;

  const qtyPreview = toMoney(form.quantity);
  const pricePreview = toMoney(form.unitPrice);
  const totalPreview = qtyPreview * pricePreview;

  const resetFormKeepProject = () => {
    setSelectedId(null);
    setForm((prev) => ({ ...emptyForm, projectId: prev.projectId }));
  };

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/extracts/work-items',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم إنشاء بند الأعمال');
        invalidateQuery(['extract-work-items']);
        resetFormKeepProject();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إنشاء البند'),
    }
  );

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('no id');
      return apiClient.put(`/extracts/work-items/${selectedId}`, payload());
    },
    onSuccess: () => {
      notifyApiSuccess('تم تعديل بند الأعمال');
      setSuccess('تم تعديل بند الأعمال');
      invalidateQuery(['extract-work-items']);
      resetFormKeepProject();
    },
    onError: (err: Error) => setError(err.message || 'تعذر تعديل البند'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/extracts/work-items/${id}`),
    onSuccess: () => {
      notifyApiSuccess('تم حذف البند');
      invalidateQuery(['extract-work-items']);
      resetFormKeepProject();
    },
    onError: (err: Error) => setError(err.message || 'تعذر حذف البند'),
  });

  function payload() {
    const itemNumber = form.itemNumber.trim();
    return {
      projectId: form.projectId,
      itemNumber,
      parentId: inferWorkItemParentId(itemNumber, tableData),
      itemGroupCode: form.itemGroupCode.trim() || undefined,
      itemGroupName: form.itemGroupName.trim() || undefined,
      arabicName: form.arabicName.trim(),
      englishName: form.englishName.trim() || undefined,
      quantity: toMoney(form.quantity),
      unit: form.unit.trim() || undefined,
      unitPrice: form.unitPrice.trim() ? toMoney(form.unitPrice) : undefined,
      notes: form.notes.trim() || undefined,
    };
  }

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!form.projectId) {
      setError('يرجى اختيار المشروع');
      return;
    }
    if (!form.itemNumber.trim() || !form.arabicName.trim()) {
      setError('رقم البند والاسم العربي مطلوبان');
      return;
    }
    if (quantityFieldDisabled) {
      setError('لا تُدخل الكمية على البنود الرئيسية — اختر بنداً تنفيذياً فرعياً');
      return;
    }
    const quantity = toMoney(form.quantity);
    if (quantity < 0) {
      setError('الكمية غير صالحة');
      return;
    }
    if (selectedId) updateMutation.mutate();
    else createMutation.mutate(payload());
  };

  const loadRow = (row: WorkItemRow) => {
    setSelectedId(row.id);
    setForm({
      projectId: row.projectId || form.projectId,
      itemNumber: row.itemNumber || '',
      itemGroupCode: row.itemGroupCode || '',
      itemGroupName: row.itemGroupName || '',
      arabicName: row.arabicName || '',
      englishName: row.englishName || '',
      quantity: String(row.quantity ?? ''),
      unit: row.unit || '',
      unitPrice: row.unitPrice != null ? String(row.unitPrice) : '',
      notes: row.notes || '',
    });
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <ExtractsPageChrome
      title="البنود العامة للمستخلصات"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'البنود العامة للمستخلصات' },
      ]}
      onSave={handleSave}
      savePending={pending}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      favoriteHref="/extracts/operations/general-extract-items"
      browseList={{
        title: 'البنود العامة',
        apiPath: '/extracts/work-items',
        listKey: 'extract-work-items-browse',
        columns: [
          { id: 'code', header: 'الكود', getValue: (r) => String(r.itemNumber || r.id) },
          { id: 'name', header: 'الاسم', getValue: (r) => String(r.arabicName || '—') },
        ],
        onSelect: (_id, row) => loadRow(row as WorkItemRow),
      }}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard
        title={selectedId ? 'تعديل بند' : 'بند جديد'}
        subtitle="كود هرمي، بند عام، كمية، سعر، وملاحظات — POST/PUT /extracts/work-items"
        icon={ListTree}
      >
        <CompactFormField label="المشروع" required>
          <select
            value={form.projectId}
            onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}
            className={compactControlClass}
          >
            <option value="">— اختر مشروعاً —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.arabicName || p.serial || p.id}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField
          label="كود البند العام"
          value={form.itemGroupCode}
          onChange={(e) => setForm((p) => ({ ...p, itemGroupCode: e.target.value }))}
          placeholder="مثل 1"
        />
        <CompactFormField
          label="اسم البند العام"
          value={form.itemGroupName}
          onChange={(e) => setForm((p) => ({ ...p, itemGroupName: e.target.value }))}
          placeholder="أعمال خرسانية"
        />
        <CompactFormField
          label="رقم البند"
          required
          value={form.itemNumber}
          onChange={(e) => setForm((p) => ({ ...p, itemNumber: e.target.value }))}
          placeholder="مثل 1.1"
        />
        <CompactFormField
          label="الإسم العربي"
          required
          value={form.arabicName}
          onChange={(e) => setForm((p) => ({ ...p, arabicName: e.target.value }))}
        />
        <CompactFormField
          label="الإسم الإنجليزي"
          value={form.englishName}
          onChange={(e) => setForm((p) => ({ ...p, englishName: e.target.value }))}
        />
        <CompactFormField
          label="الكمية"
          type="number"
          min={0}
          step="0.001"
          value={quantityFieldDisabled ? '' : form.quantity}
          readOnly={quantityFieldDisabled}
          hint={
            quantityFieldDisabled
              ? 'الكمية تُدخل على البنود التنفيذية (الفرعية) فقط — وليس على الرؤوس.'
              : undefined
          }
          onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
        />
        <CompactFormField
          label="الوحدة"
          value={form.unit}
          onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
        />
        <CompactFormField
          label="سعر الوحدة"
          type="number"
          min={0}
          step="0.01"
          value={form.unitPrice}
          onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))}
        />
        <CompactFormField
          label="الإجمالي (معاينة)"
          readOnly
          value={pricePreview ? formatEgp(totalPreview) : '—'}
          hint="يحفظ السيرفر الإجمالي عند وجود سعر وحدة."
        />
        <CompactFormField
          label="ملاحظات"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          className="sm:col-span-2"
        />
        {selectedId ? (
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={resetFormKeepProject}>
              بند جديد
            </Button>
          </div>
        ) : null}
      </FormSectionCard>

      <FormSectionCard title="بحث" subtitle="تصفية البنود بالكود أو الاسم">
        <CompactFormField
          label="الكود"
          placeholder="بحث بالكود"
          value={codeQ}
          onChange={(ev) => setCodeQ(ev.target.value)}
        />
        <CompactFormField
          label="الإسم العربي"
          placeholder="بحث بالاسم"
          value={arQ}
          onChange={(ev) => setArQ(ev.target.value)}
        />
        <CompactFormField
          label="الإسم الإنجليزي"
          placeholder="بحث بالإنجليزي"
          value={enQ}
          onChange={(ev) => setEnQ(ev.target.value)}
        />
      </FormSectionCard>

      <div className="mb-2 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpandedParentIds(new Set(parentIdsWithKids))}
        >
          توسيع الشجرة
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedParentIds(new Set())}>
          طي الشجرة
        </Button>
      </div>

      <AppTable
        columns={[
          {
            id: 'code',
            header: 'الكود',
            cell: (row) => (
              <BoqHierarchyTreeCell
                code={row.itemNumber}
                depth={row.__depth}
                isParent={row.__isParent}
                hasChildren={parentIdsWithKids.has(row.id)}
                expanded={expandedParentIds.has(row.id)}
                onToggleExpand={() => {
                  setExpandedParentIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(row.id)) next.delete(row.id);
                    else next.add(row.id);
                    return next;
                  });
                }}
              />
            ),
          },
          { id: 'group', header: 'البند العام', cell: (row) => row.itemGroupName || row.itemGroupCode || '—' },
          { id: 'ar', header: 'الإسم العربي', accessor: 'arabicName' },
          { id: 'en', header: 'الإسم الإنجليزي', accessor: 'englishName' },
          {
            id: 'qty',
            header: 'الكمية',
            numeric: true,
            cell: (row) =>
              canEnterBoqLineQuantity(row.__isParent) ? formatQty(row.quantity) : '—',
          },
          { id: 'unit', header: 'الوحدة', accessor: 'unit' },
          {
            id: 'price',
            header: 'سعر الوحدة',
            numeric: true,
            cell: (row) => (row.unitPrice != null && !row.__isParent ? formatEgp(row.unitPrice) : '—'),
          },
          {
            id: 'total',
            header: 'الإجمالي',
            numeric: true,
            cell: (row) => (row.totalPrice != null && !row.__isParent ? formatEgp(row.totalPrice) : '—'),
          },
          { id: 'notes', header: 'ملاحظات', accessor: 'notes' },
          {
            id: 'actions',
            header: 'إجراءات',
            cell: (row) => (
              <div className="flex justify-center gap-1">
                <Button type="button" size="sm" variant="secondary" onClick={() => loadRow(row)}>
                  تعديل
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const ok = await confirmAction({ message: `حذف البند ${row.itemNumber}؟`, tone: 'danger' });
                    if (ok) deleteMutation.mutate(row.id);
                  }}
                >
                  حذف
                </Button>
              </div>
            ),
          },
        ]}
        data={visibleHierarchical}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="لا توجد بنود"
        emptyDescription="أنشئ بنداً عاماً أو تنفيذياً بعد اختيار المشروع."
        exportFileName="general-extract-items"
        rowClassName={(row) => (row.__isParent ? 'bg-[#EEF6FA]' : undefined)}
        onRowClick={loadRow}
      />
    </ExtractsPageChrome>
  );
}
