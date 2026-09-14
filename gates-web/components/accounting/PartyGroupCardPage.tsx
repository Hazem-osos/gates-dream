'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import {
  PageHeader,
  Button,
  CompactFormField,
  FormStickyFooter,
  FormSectionCard,
  AppTable,
} from '@/components/ui';
import UserPermissionsBar from '@/components/UserPermissionsBar';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import type { ApiError } from '@/lib/api/types';

export type PartyGroupRow = {
  id: string;
  code?: string | null;
  legacyCode?: string | null;
  arabicName: string;
  englishName?: string | null;
  isActive?: boolean;
  _count?: { customers?: number; suppliers?: number };
};

type Kind = 'customer' | 'supplier';

const KIND_CONFIG = {
  customer: {
    title: 'مجموعة العميل',
    breadcrumbs: [
      { label: 'الحسابات', href: '/accounting' },
      { label: 'البطاقات' },
      { label: 'مجموعة العميل' },
    ],
    api: '/accounting/customer-categories',
    queryKey: ['customer-categories'] as const,
    resource: 'customer',
    emptyTitle: 'لا توجد مجموعات عملاء',
    countHeader: 'عدد العملاء',
    countOf: (row: PartyGroupRow) => row._count?.customers ?? 0,
  },
  supplier: {
    title: 'مجموعة المورد',
    breadcrumbs: [
      { label: 'الحسابات', href: '/accounting' },
      { label: 'البطاقات' },
      { label: 'مجموعة المورد' },
    ],
    api: '/accounting/supplier-categories',
    queryKey: ['supplier-categories'] as const,
    resource: 'supplier',
    emptyTitle: 'لا توجد مجموعات موردين',
    countHeader: 'عدد الموردين',
    countOf: (row: PartyGroupRow) => row._count?.suppliers ?? 0,
  },
} as const;

const emptyForm = () => ({
  code: '',
  arabicName: '',
  englishName: '',
});

export function PartyGroupCardPage({ kind }: { kind: Kind }) {
  const config = KIND_CONFIG[kind];
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useApiQuery<PartyGroupRow[]>(config.queryKey, config.api, {
    limit: 500,
    isActive: true,
  });
  const rows = data?.data ?? [];

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(config.api, 'POST', {
    onSuccess: () => {
      invalidateQuery(config.queryKey);
      setSelectedId(null);
      setFormData(emptyForm());
    },
    onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
  });

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedId ? `${config.api}/${selectedId}` : config.api,
    'PUT',
    {
      onSuccess: () => invalidateQuery(config.queryKey),
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
    }
  );

  const loading = createMutation.isPending || updateMutation.isPending || deleting;

  const requestBody = () => ({
    code: formData.code.trim(),
    arabicName: formData.arabicName.trim(),
    englishName: formData.englishName.trim() || undefined,
  });

  const handleSave = () => {
    setError('');
    if (!formData.code.trim()) {
      setError('كود المجموعة مطلوب');
      return;
    }
    if (!formData.arabicName.trim()) {
      setError('اسم المجموعة مطلوب');
      return;
    }
    if (selectedId) {
      updateMutation.mutate(requestBody());
      return;
    }
    createMutation.mutate(requestBody());
  };

  const handleNew = () => {
    setSelectedId(null);
    setFormData(emptyForm());
    setError('');
  };

  const handleSelect = (row: PartyGroupRow) => {
    setSelectedId(row.id);
    setFormData({
      code: row.code || row.legacyCode || '',
      arabicName: row.arabicName || '',
      englishName: row.englishName || '',
    });
    setError('');
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('هل تريد حذف هذه المجموعة؟ العملاء أو الموردين المرتبطين بها سيبقون بدون مجموعة.')) {
      return;
    }
    setDeleting(true);
    setError('');
    try {
      await apiClient.delete(`${config.api}/${selectedId}`);
      invalidateQuery(config.queryKey);
      handleNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف المجموعة');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}

      <PageHeader
        title={config.title}
        breadcrumbs={[...config.breadcrumbs]}
        actions={
          <Button variant="primary" onClick={handleNew}>
            مجموعة جديدة
          </Button>
        }
      />

      <div className="mb-4">
        <UserPermissionsBar resource={config.resource} module="accounting" />
      </div>

      <section className="mb-6">
        <AppTable<PartyGroupRow>
          isLoading={isLoading}
          data={rows}
          getRowKey={(r) => r.id}
          emptyTitle={config.emptyTitle}
          onRowClick={handleSelect}
          rowClassName={(r) => (r.id === selectedId ? 'bg-sky-50' : undefined)}
          columns={[
            {
              id: 'code',
              header: 'الكود',
              cell: (r) => r.code || r.legacyCode || '—',
            },
            { id: 'name', header: 'الاسم', accessor: 'arabicName' },
            {
              id: 'count',
              header: config.countHeader,
              cell: (r) => String(config.countOf(r)),
            },
          ]}
        />
      </section>

      <FormSectionCard
        title="البيانات الأساسية"
        subtitle={selectedId ? 'تعديل المجموعة المحددة' : 'إنشاء مجموعة جديدة'}
        icon={Users}
      >
        <CompactFormField
          label="كود المجموعة"
          required
          value={formData.code}
          onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
          placeholder="01"
        />
        <CompactFormField
          label="اسم المجموعة"
          required
          value={formData.arabicName}
          onChange={(e) => setFormData((prev) => ({ ...prev, arabicName: e.target.value }))}
          placeholder="alex"
        />
        <CompactFormField
          label="الاسم الإنجليزي"
          value={formData.englishName}
          onChange={(e) => setFormData((prev) => ({ ...prev, englishName: e.target.value }))}
          placeholder="اختياري"
        />
      </FormSectionCard>

      <FormStickyFooter
        onCancel={handleNew}
        onSave={handleSave}
        saveLoading={loading}
        saveDisabled={loading}
        status={selectedId ? 'تعديل' : 'جديد'}
        extraActions={
          selectedId ? (
            <Button variant="danger" onClick={() => void handleDelete()} disabled={loading}>
              حذف
            </Button>
          ) : null
        }
      />
    </div>
  );
}
