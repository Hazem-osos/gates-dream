'use client';

import { useMemo, useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ListTree } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

type WorkItemRow = {
  id: string;
  itemNumber: string;
  arabicName: string;
  englishName?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
};

type ProjectOption = { id: string; arabicName?: string; serial?: string };

export default function GeneralExtractItemsPage() {
  useBackendReachability();
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [codeQ, setCodeQ] = useState('');
  const [arQ, setArQ] = useState('');
  const [enQ, setEnQ] = useState('');
  const [form, setForm] = useState({
    projectId: '',
    itemNumber: '',
    arabicName: '',
    englishName: '',
    quantity: '1',
    unit: '',
  });

  const { data: projectsRes } = useApiQuery<ProjectOption[]>(
    ['extracts-projects', 'work-item-create'],
    '/extracts/projects',
    { limit: 500, isActive: true }
  );
  const projects = projectsRes?.data ?? [];

  const { data: itemsResponse, isLoading } = useApiQuery<WorkItemRow[]>(
    ['extract-work-items'],
    '/extracts/work-items',
    { limit: 200 }
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

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/extracts/work-items',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم إنشاء بند الأعمال');
        invalidateQuery(['extract-work-items']);
        setForm((prev) => ({
          ...prev,
          itemNumber: '',
          arabicName: '',
          englishName: '',
          quantity: '1',
          unit: '',
        }));
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إنشاء البند'),
    }
  );

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
    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setError('الكمية غير صالحة');
      return;
    }
    createMutation.mutate({
      projectId: form.projectId,
      itemNumber: form.itemNumber.trim(),
      arabicName: form.arabicName.trim(),
      englishName: form.englishName.trim() || undefined,
      quantity,
      unit: form.unit.trim() || undefined,
    });
  };

  return (
    <ExtractsPageChrome
      title="البنود العامة للمستخلصات"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'البنود العامة للمستخلصات' },
      ]}
      onSave={handleSave}
      savePending={createMutation.isPending}
      statusLabel="جديد"
      favoriteHref="/extracts/operations/general-extract-items"
      browseList={{
        title: 'البنود العامة',
        apiPath: '/extracts/work-items',
        listKey: 'extract-work-items-browse',
        columns: [
          { id: 'code', header: 'الكود', getValue: (r) => String(r.itemNumber || r.id) },
          { id: 'name', header: 'الاسم', getValue: (r) => String(r.arabicName || '—') },
        ],
        onSelect: () => undefined,
      }}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard title="بند جديد" subtitle="إنشاء بند أعمال عبر POST /extracts/work-items" icon={ListTree}>
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
          label="رقم البند"
          required
          value={form.itemNumber}
          onChange={(e) => setForm((p) => ({ ...p, itemNumber: e.target.value }))}
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
          step="0.01"
          value={form.quantity}
          onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
        />
        <CompactFormField
          label="الوحدة"
          value={form.unit}
          onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
        />
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

      <AppTable
        columns={[
          { id: 'code', header: 'الكود', accessor: 'itemNumber' },
          { id: 'ar', header: 'الإسم العربي', accessor: 'arabicName' },
          { id: 'en', header: 'الإسم الإنجليزي', accessor: 'englishName' },
          { id: 'qty', header: 'الكمية', accessor: 'quantity' },
          { id: 'unit', header: 'الوحدة', accessor: 'unit' },
        ]}
        data={filtered}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="لا توجد بنود"
        exportFileName="general-extract-items"
      />
    </ExtractsPageChrome>
  );
}
