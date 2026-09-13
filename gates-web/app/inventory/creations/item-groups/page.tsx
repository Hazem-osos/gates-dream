'use client';

import { useState } from 'react';
import { Boxes } from 'lucide-react';
import {
  PageHeader,
  Button,
  CompactFormField,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { UserPermissions } from '@/components/ui/UserPermissions';
import {
  ItemGroupsListSection,
  type ItemGroupRow,
} from '@/components/inventory/ItemGroupsListSection';
import { useRouter } from 'next/navigation';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import type { ApiError } from '@/lib/api/types';

type GroupForm = {
  code: string;
  arabicName: string;
  englishName: string;
  groupType: 'MAIN' | 'SUB';
  parentCategoryId: string;
  isFeatured: boolean;
  isTaxExempt: boolean;
  taxRate: string;
};

const emptyForm = (): GroupForm => ({
  code: '',
  arabicName: '',
  englishName: '',
  groupType: 'MAIN',
  parentCategoryId: '',
  isFeatured: false,
  isTaxExempt: false,
  taxRate: '',
});

const checkboxCls =
  'w-4 h-4 text-[#0E78AA] bg-white border border-[#0E78AA] rounded focus:ring-2 focus:ring-[#0E78AA]/20';

export default function ItemGroupCardPage() {
  const router = useRouter();
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<GroupForm>(emptyForm);
  const [error, setError] = useState('');

  const { data: groupsResponse } = useApiQuery<ItemGroupRow[]>(
    ['item-categories', 'parents'],
    '/inventory/item-categories',
    { limit: 200, isActive: true }
  );
  const parentOptions = (groupsResponse?.data ?? []).filter((row) => row.id !== selectedId);

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/item-categories',
    'POST',
    {
      onSuccess: () => {
        invalidateQuery(['item-categories']);
        setSelectedId(null);
        setFormData(emptyForm());
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
    }
  );

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedId ? `/inventory/item-categories/${selectedId}` : '/inventory/item-categories',
    'PUT',
    {
      onSuccess: () => invalidateQuery(['item-categories']),
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
    }
  );

  const loading = createMutation.isPending || updateMutation.isPending;
  const patch = (next: Partial<GroupForm>) => setFormData((prev) => ({ ...prev, ...next }));

  const requestBody = () => ({
    code: formData.code || undefined,
    arabicName: formData.arabicName,
    englishName: formData.englishName || undefined,
    groupType: formData.groupType,
    parentCategoryId: formData.parentCategoryId || null,
    isFeatured: formData.isFeatured,
    isTaxExempt: formData.isTaxExempt,
    taxRate: formData.taxRate === '' ? null : Number(formData.taxRate),
  });

  const handleSave = () => {
    setError('');
    if (!formData.arabicName.trim()) {
      setError('يرجى إدخال اسم المجموعة');
      return;
    }
    if (selectedId && formData.parentCategoryId === selectedId) {
      setError('لا يمكن أن تكون المجموعة رئيسية لنفسها');
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

  const handleSelect = (row: ItemGroupRow) => {
    setSelectedId(row.id);
    setFormData({
      code: row.code ?? '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
      groupType: row.groupType === 'SUB' ? 'SUB' : 'MAIN',
      parentCategoryId: row.parentCategoryId ?? '',
      isFeatured: Boolean(row.isFeatured),
      isTaxExempt: Boolean(row.isTaxExempt),
      taxRate: row.taxRate != null && row.taxRate !== '' ? String(row.taxRate) : '',
    });
    setError('');
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}

      <PageHeader
        title="دليل الأصناف"
        breadcrumbs={[
          { label: 'المخزون', href: '/inventory' },
          { label: 'التعريفات' },
          { label: 'مجموعات الأصناف' },
        ]}
        actions={
          <Button variant="primary" onClick={handleNew}>
            مجموعة جديدة
          </Button>
        }
      />

      <ItemGroupsListSection onSelect={handleSelect} selectedId={selectedId} />

      <PageHeader title="بطاقة مجموعة أصناف" className="mb-4" />
      <div className="mb-4 flex justify-between">
        <UserPermissions />
      </div>

      <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف مجموعة الأصناف" icon={Boxes}>
        <CompactFormField
          label="رقم المجموعة"
          value={formData.code}
          onChange={(e) => patch({ code: e.target.value })}
          placeholder="إدخل رقم المجموعة"
        />
        <CompactFormField
          label="اسم المجموعة"
          required
          value={formData.arabicName}
          onChange={(e) => patch({ arabicName: e.target.value })}
          placeholder="ادخل الإسم"
        />
        <CompactFormField
          label="الاسم الإنجليزي"
          value={formData.englishName}
          onChange={(e) => patch({ englishName: e.target.value })}
          placeholder="إدخل الإسم بالإنجليزي"
        />
        <CompactFormField label="نوع المجموعة">
          <select
            className={compactControlClass}
            value={formData.groupType}
            onChange={(e) => patch({ groupType: e.target.value as 'MAIN' | 'SUB' })}
          >
            <option value="MAIN">مجموعة رئيسية</option>
            <option value="SUB">مجموعة فرعية</option>
          </select>
        </CompactFormField>
        <CompactFormField label="مميزة">
          <label className="flex h-9 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isFeatured}
              onChange={(e) => patch({ isFeatured: e.target.checked })}
              className={checkboxCls}
            />
            <span className="text-sm font-semibold text-[#0A3D5E]">مميزة</span>
          </label>
        </CompactFormField>
        <CompactFormField label="م/رئيسي">
          <select
            className={compactControlClass}
            value={formData.parentCategoryId}
            onChange={(e) => patch({ parentCategoryId: e.target.value })}
          >
            <option value="">—</option>
            {parentOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.arabicName}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField label="ضريبة المبيعات">
          <label className="flex h-9 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isTaxExempt}
              onChange={(e) => patch({ isTaxExempt: e.target.checked })}
              className={checkboxCls}
            />
            <span className="text-sm font-semibold text-[#0A3D5E]">معفي</span>
          </label>
        </CompactFormField>
        <CompactFormField
          label="قيمة الضريبة"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={formData.taxRate}
          onChange={(e) => patch({ taxRate: e.target.value })}
          placeholder="0"
          suffix="%"
        />
      </FormSectionCard>

      <FormStickyFooter
        onCancel={() => router.back()}
        onSave={handleSave}
        saveLoading={loading}
        saveDisabled={loading}
        status={selectedId ? 'تعديل' : 'مسودة'}
      />
    </div>
  );
}
