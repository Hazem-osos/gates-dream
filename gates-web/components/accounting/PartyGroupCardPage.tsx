'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import {
  CompactFormField,
  FormSectionCard,
  AppTable,
} from '@/components/ui';
import { DocumentBrowseDrawer, MasterCardShell } from '@/components/erp';
import UserPermissionsBar from '@/components/UserPermissionsBar';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import type { ApiError } from '@/lib/api/types';
import { confirmAction } from '@/lib/feedback/confirm';

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
  const [showGuide, setShowGuide] = useState(false);

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
      onSuccess: () => {
        invalidateQuery(config.queryKey);
        setSelectedId(null);
        setFormData(emptyForm());
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
    }
  );

  const loading = createMutation.isPending || updateMutation.isPending || deleting;

  const requestBody = () => ({
    code: formData.code.trim() || undefined,
    arabicName: formData.arabicName.trim(),
    englishName: formData.englishName.trim() || undefined,
  });

  const handleSave = () => {
    setError('');
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
    if (!(await confirmAction('هل تريد حذف هذه المجموعة؟ العملاء أو الموردين المرتبطين بها سيبقون بدون مجموعة.'))) {
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

  const groupTable = (
    <AppTable<PartyGroupRow>
      isLoading={isLoading}
      data={rows}
      getRowKey={(r) => r.id}
      emptyTitle={config.emptyTitle}
      onRowClick={(row) => {
        handleSelect(row);
        setShowGuide(false);
      }}
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
  );

  return (
    <MasterCardShell
      title={config.title}
      breadcrumbs={[...config.breadcrumbs]}
      docNumber={formData.code || (selectedId ? 'تعديل' : 'جديد')}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      onSave={handleSave}
      savePending={loading}
      canSave={!loading}
      onNew={handleNew}
      onDelete={() => void handleDelete()}
      currentId={selectedId}
      onBrowseList={() => setShowGuide(true)}
      favoriteHref={kind === 'customer' ? '/accounting/cards/customer-group' : '/accounting/cards/supplier-group'}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}

      <div className="mb-4">
        <UserPermissionsBar resource={config.resource} module="accounting" />
      </div>

      <FormSectionCard
        title="البيانات الأساسية"
        subtitle={selectedId ? 'تعديل المجموعة المحددة' : 'إنشاء مجموعة جديدة'}
        icon={Users}
      >
        <CompactFormField
          label="كود المجموعة"
          value={formData.code}
          disabled={!selectedId}
          readOnly={!selectedId}
          onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
          placeholder="تلقائي"
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

      <DocumentBrowseDrawer
        open={showGuide}
        onClose={() => setShowGuide(false)}
        title={kind === 'customer' ? 'مجموعات العملاء السابقة' : 'مجموعات الموردين السابقة'}
      >
        {groupTable}
      </DocumentBrowseDrawer>
    </MasterCardShell>
  );
}
